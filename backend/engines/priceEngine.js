/* ═══════════════════════════════════════════════════
   Price Engine — Production-Grade Market Feed
   
   Features:
   • Dynamic instrument resolution via CSV
   • Heartbeat timeout detection (auto-reconnect)
   • Full protobuf V3 decoding
   • Market hours guard
   • Exponential backoff with jitter
   • Socket.IO live price push
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
const PRICE_EMIT_INTERVAL = 500; // emit to Socket.IO every 500ms

/* Resolved instrument maps (populated on start) */
let SYMBOL_MAP = {};
let INSTRUMENT_TO_SYMBOL = {};
let INSTRUMENT_KEYS = [];

/* Connection state */
let connectionState = "disconnected"; // disconnected | connecting | connected
let connectedAt = null;

/* ── Public API ── */

/**
 * Set the Upstox access token and (re)start the feed.
 */
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

/**
 * Start the price engine:
 * 1. Load protobuf schema
 * 2. Resolve instruments dynamically
 * 3. Connect to Upstox WS
 */
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
  } catch (err) {
    logger.error(`[ENGINE] Instrument resolution failed: ${err.message}`);
    // Fallback to index keys only
    SYMBOL_MAP = {
      NIFTY: "NSE_INDEX|Nifty 50",
      BANKNIFTY: "NSE_INDEX|Nifty Bank",
    };
    INSTRUMENT_TO_SYMBOL = {
      "NSE_INDEX|Nifty 50": "NIFTY",
      "NSE_INDEX|Nifty Bank": "BANKNIFTY",
    };
    INSTRUMENT_KEYS = Object.values(SYMBOL_MAP);
  }

  // 3. Check token
  if (!accessToken) {
    logger.warn("[ENGINE] Token not set — waiting for POST /api/set-token or env UPSTOX_ACCESS_TOKEN");
    return;
  }

  await connectFeed();
}

/**
 * Stop the WebSocket cleanly.
 */
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

/**
 * Get current engine status for the feed-status API.
 */
function getStatus() {
  return {
    connectionState,
    connectedAt,
    accessTokenSet: !!accessToken,
    reconnectAttempts,
    instrumentCount: INSTRUMENT_KEYS.length,
    instruments: SYMBOL_MAP,
    socketClients: socketService.getConnectedCount(),
    feedStatus: priceCache.getFeedStatus(),
  };
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

  // Market hours guard (skip if outside market hours)
  if (!isMarketOpen()) {
    logger.ws("[ENGINE] Market closed — will retry when market opens");
    // Check every 60 seconds if market has opened
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

      // Subscribe with full mode
      const subscribeMsg = {
        guid: "paper-trading-v3",
        method: "sub",
        data: { mode: "full", instrumentKeys: INSTRUMENT_KEYS },
      };
      ws.send(JSON.stringify(subscribeMsg));
      logger.feed(`[ENGINE] Subscribed to ${INSTRUMENT_KEYS.length} instruments (mode: full)`);

      // Start heartbeat monitor
      resetHeartbeat();

      // Start Socket.IO price emission interval
      startPriceEmitter();
    });

    ws.on("message", (buffer) => {
      try {
        // Reset heartbeat on any message
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

          // Extract price from the various feed structures
          price = extractPrice(feed);

          if (!price || price <= 0) continue;

          const symbol = INSTRUMENT_TO_SYMBOL[key];
          if (symbol) {
            priceCache.set(symbol, price);
          }
        }

        logger.price("LIVE:", priceCache.getAll());
      } catch (err) {
        // Heartbeat/ping packets — ignore decode errors
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
 * Handles all V3 feed structures:
 *   1. ltpc.ltp (ltpc mode)
 *   2. fullFeed.marketFF.ltpc.ltp (market full feed)
 *   3. fullFeed.indexFF.ltpc.ltp (index full feed)
 *   4. fullFeed.marketFF.marketOHLC.ohlc[0].close (OHLC fallback)
 *   5. firstLevelWithGreeks.ltpc.ltp (option greeks mode)
 */
function extractPrice(feed) {
  // Case 1: Direct LTPC mode
  if (feed.ltpc && feed.ltpc.ltp) {
    return feed.ltpc.ltp;
  }

  // Case 2: Full Feed — Market
  if (feed.fullFeed) {
    const ff = feed.fullFeed;

    if (ff.marketFF && ff.marketFF.ltpc && ff.marketFF.ltpc.ltp) {
      return ff.marketFF.ltpc.ltp;
    }

    // Case 3: Full Feed — Index
    if (ff.indexFF && ff.indexFF.ltpc && ff.indexFF.ltpc.ltp) {
      return ff.indexFF.ltpc.ltp;
    }

    // Case 4: OHLC close fallback (market)
    if (
      ff.marketFF &&
      ff.marketFF.marketOHLC &&
      ff.marketFF.marketOHLC.ohlc &&
      ff.marketFF.marketOHLC.ohlc.length > 0
    ) {
      return ff.marketFF.marketOHLC.ohlc[0].close;
    }

    // Case 4b: OHLC close fallback (index)
    if (
      ff.indexFF &&
      ff.indexFF.marketOHLC &&
      ff.indexFF.marketOHLC.ohlc &&
      ff.indexFF.marketOHLC.ohlc.length > 0
    ) {
      return ff.indexFF.marketOHLC.ohlc[0].close;
    }
  }

  // Case 5: First Level With Greeks
  if (feed.firstLevelWithGreeks && feed.firstLevelWithGreeks.ltpc && feed.firstLevelWithGreeks.ltpc.ltp) {
    return feed.firstLevelWithGreeks.ltpc.ltp;
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

/**
 * Heartbeat: if no tick for HEARTBEAT_TIMEOUT_MS, force reconnect.
 */
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

/**
 * Exponential backoff with jitter for reconnections.
 */
function scheduleReconnect() {
  if (reconnectTimer) return;

  // Don't reconnect spam outside market hours
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
  const jitter = Math.random() * 1000; // 0–1s jitter
  const delay = baseDelay + jitter;

  logger.ws(`[ENGINE] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempts})`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectFeed();
  }, delay);
}

/**
 * Periodically emit price updates to Socket.IO clients.
 */
function startPriceEmitter() {
  if (priceEmitTimer) clearInterval(priceEmitTimer);

  priceEmitTimer = setInterval(() => {
    const prices = priceCache.getAll();
    if (Object.keys(prices).length > 0) {
      socketService.emitPriceUpdate(prices);
    }
  }, PRICE_EMIT_INTERVAL);
}

module.exports = { start, stop, setToken, getToken, getStatus, SYMBOL_MAP };
