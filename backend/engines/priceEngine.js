/* ═══════════════════════════════════════════════════
   Price Engine — Production-Grade Market Feed
   
   Features:
   • Dynamic instrument resolution via CSV
   • Heartbeat timeout detection (auto-reconnect)
   • Full protobuf V3 decoding with OI extraction
   • Market hours guard
   • Exponential backoff with jitter
   • Socket.IO live price push
   • Dynamic subscribe/unsubscribe for option chains
   ═══════════════════════════════════════════════════ */

const WebSocket = require("ws");
const axios = require("axios");
const protobuf = require("protobufjs");
const path = require("path");
const logger = require("../utils/logger");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const { resolveInstruments } = require("../services/instrumentResolver");
const socketService = require("../services/socketService");
const { UPSTOX_ACCESS_TOKEN, HEARTBEAT_TIMEOUT_MS } = require("../config/env");

/* ── State ── */

let accessToken = UPSTOX_ACCESS_TOKEN || null;
let ws = null;
let FeedResponse = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let reconnectAttempts = 0;
let priceEmitTimer = null;

const MAX_RECONNECT_DELAY = 60000;
const PRICE_EMIT_INTERVAL = 100;

/* Resolved instrument maps (populated on start) */
let SYMBOL_MAP = {};
let INSTRUMENT_TO_SYMBOL = {};
let INSTRUMENT_KEYS = [];

/* Track which keys are "core" (always subscribed) vs "option chain" (dynamic) */
let CORE_KEYS = [];
let OPTION_CHAIN_KEYS = [];

/* Connection state */
let connectionState = "disconnected";
let connectedAt = null;

/* ── Public API ── */

async function setToken(token) {
  accessToken = token;
  logger.ws("[ENGINE] Access token updated");
  reconnectAttempts = 0;
  stop();
  await start();
}

function getToken() {
  return accessToken;
}

async function start() {
  // 1. Load protobuf
  const protoPath = path.join(__dirname, "..", "MarketDataFeed.proto");
  const root = await protobuf.load(protoPath);
  FeedResponse = root.lookupType(
    "com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse"
  );
  logger.success("[ENGINE] Proto V3 schema loaded");

  // 2. Resolve instruments
  try {
    const resolved = await resolveInstruments();
    SYMBOL_MAP = resolved.symbolMap;
    INSTRUMENT_TO_SYMBOL = resolved.instrumentToSymbol;
    INSTRUMENT_KEYS = resolved.instrumentKeys;
    CORE_KEYS = [...resolved.instrumentKeys]; // Core keys never get unsubscribed
  } catch (err) {
    logger.error(`[ENGINE] Instrument resolution failed: ${err.message}`);
    SYMBOL_MAP = {
      NIFTY: "NSE_INDEX|Nifty 50",
      BANKNIFTY: "NSE_INDEX|Nifty Bank",
    };
    INSTRUMENT_TO_SYMBOL = {
      "NSE_INDEX|Nifty 50": "NIFTY",
      "NSE_INDEX|Nifty Bank": "BANKNIFTY",
    };
    INSTRUMENT_KEYS = Object.values(SYMBOL_MAP);
    CORE_KEYS = [...INSTRUMENT_KEYS];
  }

  // 3. Check token
  if (!accessToken) {
    logger.warn("[ENGINE] Token not set — waiting for POST /api/set-token or env UPSTOX_ACCESS_TOKEN");
    return;
  }

  await connectFeed();
}

function stop() {
  clearTimers();

  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }

  connectionState = "disconnected";
  priceCache.setFeedConnected(false);
  logger.ws("[ENGINE] Price engine stopped");
}

function getStatus() {
  return {
    connectionState,
    connectedAt,
    accessTokenSet: !!accessToken,
    reconnectAttempts,
    instrumentCount: INSTRUMENT_KEYS.length,
    coreKeyCount: CORE_KEYS.length,
    optionChainKeyCount: OPTION_CHAIN_KEYS.length,
    instruments: SYMBOL_MAP,
    socketClients: socketService.getConnectedCount(),
    feedStatus: priceCache.getFeedStatus(),
  };
}

/**
 * Dynamically subscribe to new instrument keys (e.g. for Option Chains)
 */
function addSubscription(keys, mapping = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  const newKeys = keys.filter(k => !INSTRUMENT_KEYS.includes(k));
  if (newKeys.length === 0) return;

  INSTRUMENT_KEYS.push(...newKeys);
  Object.assign(SYMBOL_MAP, mapping);
  for (const [sym, key] of Object.entries(mapping)) {
    INSTRUMENT_TO_SYMBOL[key] = sym;
  }

  const subscribeMsg = {
    guid: `add-sub-${Date.now()}`,
    method: "sub",
    data: { mode: "full", instrumentKeys: newKeys },
  };
  ws.send(JSON.stringify(subscribeMsg));
  logger.feed(`[ENGINE] Dynamically subscribed to ${newKeys.length} new instruments`);
}

/**
 * Replace option chain subscriptions.
 * Unsubscribes old option chain keys and subscribes to new ones.
 * Core keys (indexes + futures) are never unsubscribed.
 */
function replaceSubscription(newKeys, mapping = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // 1. Unsubscribe old option chain keys
  if (OPTION_CHAIN_KEYS.length > 0) {
    const unsubMsg = {
      guid: `unsub-${Date.now()}`,
      method: "unsub",
      data: { instrumentKeys: OPTION_CHAIN_KEYS },
    };
    ws.send(JSON.stringify(unsubMsg));
    logger.feed(`[ENGINE] Unsubscribed ${OPTION_CHAIN_KEYS.length} old option chain keys`);

    // Clean up old keys from maps
    for (const key of OPTION_CHAIN_KEYS) {
      const sym = INSTRUMENT_TO_SYMBOL[key];
      if (sym) {
        delete SYMBOL_MAP[sym];
        delete INSTRUMENT_TO_SYMBOL[key];
      }
    }
  }

  // 2. Filter out keys that are already in core
  const uniqueNewKeys = newKeys.filter(k => !CORE_KEYS.includes(k));

  // 3. Update tracking
  OPTION_CHAIN_KEYS = uniqueNewKeys;
  INSTRUMENT_KEYS = [...CORE_KEYS, ...uniqueNewKeys];

  // 4. Update maps
  Object.assign(SYMBOL_MAP, mapping);
  for (const [sym, key] of Object.entries(mapping)) {
    INSTRUMENT_TO_SYMBOL[key] = sym;
  }

  // 5. Subscribe to new keys
  if (uniqueNewKeys.length > 0) {
    const subMsg = {
      guid: `sub-${Date.now()}`,
      method: "sub",
      data: { mode: "full", instrumentKeys: uniqueNewKeys },
    };
    ws.send(JSON.stringify(subMsg));
    logger.feed(`[ENGINE] Subscribed to ${uniqueNewKeys.length} new option chain keys`);
  }
}

/* ── Internals ── */

async function restart() {
  stop();
  await connectFeed();
}

function clearTimers() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (priceEmitTimer) {
    clearInterval(priceEmitTimer);
    priceEmitTimer = null;
  }
}

async function connectFeed() {
  if (!accessToken) return;

  if (!isMarketOpen()) {
    logger.ws("[ENGINE] Market closed — will retry when market opens");
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      await connectFeed();
    }, 60000);
    return;
  }

  connectionState = "connecting";

  try {
    // 1. Load snapshot LTP via REST
    await loadSnapshot();

    // 2. Authorize WS v3
    const authRes = await axios.get(
      "https://api.upstox.com/v3/feed/market-data-feed/authorize",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const wsUrl = authRes.data.data.authorized_redirect_uri;
    logger.ws("[ENGINE] WS authorized");

    // 3. Open WebSocket
    ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      logger.success("[ENGINE] Upstox WS connected ✓");
      connectionState = "connected";
      connectedAt = new Date().toISOString();
      reconnectAttempts = 0;
      priceCache.setFeedConnected(true);

      const subscribeMsg = {
        guid: "paper-trading-v3",
        method: "sub",
        data: { mode: "full", instrumentKeys: INSTRUMENT_KEYS },
      };
      ws.send(JSON.stringify(subscribeMsg));
      logger.feed(`[ENGINE] Subscribed to ${INSTRUMENT_KEYS.length} instruments (mode: full)`);

      resetHeartbeat();
      startPriceEmitter();
    });

    ws.on("message", (buffer) => {
      try {
        resetHeartbeat();

        const decoded = FeedResponse.decode(new Uint8Array(buffer));
        const obj = FeedResponse.toObject(decoded, {
          longs: Number,
          enums: String,
          defaults: true,
        });

        if (!obj.feeds) return;

        for (const key of Object.keys(obj.feeds)) {
          const feed = obj.feeds[key];
          let price = null;

          price = extractPrice(feed);
          if (!price || price <= 0) continue;

          const symbol = INSTRUMENT_TO_SYMBOL[key];
          if (symbol) {
            priceCache.set(symbol, price);
          }

          // Extract OI if available
          const oi = extractOI(feed);
          if (oi !== null && symbol) {
            priceCache.setOI(symbol, oi);
          }
        }

        logger.price("LIVE:", priceCache.getAll());
      } catch (err) {
        logger.debug(`[ENGINE] Packet decode skip: ${err.message}`);
      }
    });

    ws.on("close", (code, reason) => {
      logger.warn(`[ENGINE] WS closed (code: ${code}, reason: ${reason || "none"})`);
      connectionState = "disconnected";
      priceCache.setFeedConnected(false);
      clearTimers();
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      logger.error(`[ENGINE] WS error: ${err.message}`);
    });
  } catch (err) {
    logger.error(
      "[ENGINE] WS init failed:",
      err.response?.data || err.message
    );
    connectionState = "disconnected";
    scheduleReconnect();
  }
}

/**
 * Extract price from a Feed object.
 */
function extractPrice(feed) {
  if (feed.ltpc && feed.ltpc.ltp) {
    return feed.ltpc.ltp;
  }

  if (feed.fullFeed) {
    const ff = feed.fullFeed;

    if (ff.marketFF && ff.marketFF.ltpc && ff.marketFF.ltpc.ltp) {
      return ff.marketFF.ltpc.ltp;
    }

    if (ff.indexFF && ff.indexFF.ltpc && ff.indexFF.ltpc.ltp) {
      return ff.indexFF.ltpc.ltp;
    }

    if (
      ff.marketFF &&
      ff.marketFF.marketOHLC &&
      ff.marketFF.marketOHLC.ohlc &&
      ff.marketFF.marketOHLC.ohlc.length > 0
    ) {
      return ff.marketFF.marketOHLC.ohlc[0].close;
    }

    if (
      ff.indexFF &&
      ff.indexFF.marketOHLC &&
      ff.indexFF.marketOHLC.ohlc &&
      ff.indexFF.marketOHLC.ohlc.length > 0
    ) {
      return ff.indexFF.marketOHLC.ohlc[0].close;
    }
  }

  if (feed.firstLevelWithGreeks && feed.firstLevelWithGreeks.ltpc && feed.firstLevelWithGreeks.ltpc.ltp) {
    return feed.firstLevelWithGreeks.ltpc.ltp;
  }

  return null;
}

/**
 * Extract Open Interest from a Feed object.
 */
function extractOI(feed) {
  if (feed.fullFeed) {
    const ff = feed.fullFeed;

    // Market full feed may have eFeedDetails with OI
    if (ff.marketFF) {
      // Check eFeedDetails
      if (ff.marketFF.eFeedDetails && ff.marketFF.eFeedDetails.oi !== undefined) {
        return ff.marketFF.eFeedDetails.oi;
      }
      // Check marketLevel
      if (ff.marketFF.marketLevel && ff.marketFF.marketLevel.oi !== undefined) {
        return ff.marketFF.marketLevel.oi;
      }
    }
  }

  // firstLevelWithGreeks has OI data
  if (feed.firstLevelWithGreeks && feed.firstLevelWithGreeks.oi !== undefined) {
    return feed.firstLevelWithGreeks.oi;
  }

  return null;
}

/**
 * Load a one-time REST snapshot for initial prices.
 */
async function loadSnapshot() {
  try {
    const instrumentKeys = INSTRUMENT_KEYS.join(",");
    const res = await axios.get(
      "https://api.upstox.com/v2/market-quote/ltp",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { instrument_key: instrumentKeys },
      }
    );

    const data = res.data.data;

    for (const [symbol, instrumentKey] of Object.entries(SYMBOL_MAP)) {
      const restKey = instrumentKey.replace("|", ":");
      const price = data[restKey]?.last_price || null;
      if (price) priceCache.set(symbol, price);
    }

    logger.success("[ENGINE] Snapshot loaded:", priceCache.getAll());
  } catch (err) {
    logger.warn("[ENGINE] Snapshot error:", err.response?.data || err.message);
  }
}

function resetHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);

  heartbeatTimer = setTimeout(() => {
    logger.warn(`[ENGINE] No tick for ${HEARTBEAT_TIMEOUT_MS / 1000}s — forcing reconnect`);
    connectionState = "disconnected";
    priceCache.setFeedConnected(false);

    if (ws) {
      ws.removeAllListeners();
      ws.close();
      ws = null;
    }

    scheduleReconnect();
  }, HEARTBEAT_TIMEOUT_MS);
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  if (!isMarketOpen()) {
    logger.ws("[ENGINE] Market closed — pausing reconnect");
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      await connectFeed();
    }, 60000);
    return;
  }

  reconnectAttempts++;
  const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  const jitter = Math.random() * 1000;
  const delay = baseDelay + jitter;

  logger.ws(`[ENGINE] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempts})`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectFeed();
  }, delay);
}

function startPriceEmitter() {
  if (priceEmitTimer) clearInterval(priceEmitTimer);

  priceEmitTimer = setInterval(() => {
    const prices = priceCache.getAll();
    if (Object.keys(prices).length > 0) {
      socketService.emitPriceUpdate(prices);
    }
  }, PRICE_EMIT_INTERVAL);
}

module.exports = { start, stop, setToken, getToken, getStatus, addSubscription, replaceSubscription, SYMBOL_MAP };
