const WebSocket = require("ws");
const axios = require("axios");
const protobuf = require("protobufjs");
const path = require("path");
const logger = require("../utils/logger");
const priceCache = require("../utils/priceCache");

/**
 * Symbol configuration — add new symbols here.
 * Keys = friendly name, Values = Upstox instrument key.
 */
const SYMBOL_MAP = {
  NIFTY: "NSE_INDEX|Nifty 50",
  BANKNIFTY: "NSE_INDEX|Nifty Bank",
};

// Reverse map for decoding WS messages
const INSTRUMENT_TO_SYMBOL = {};
for (const [sym, key] of Object.entries(SYMBOL_MAP)) {
  INSTRUMENT_TO_SYMBOL[key] = sym;
}

/* ── State ── */

let accessToken = null;
let ws = null;
let FeedResponse = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

/* ── Public API ── */

/**
 * Set the Upstox access token and (re)start the feed.
 */
async function setToken(token) {
  accessToken = token;
  logger.info("Access token updated");
  reconnectAttempts = 0;
  await restart();
}

function getToken() {
  return accessToken;
}

/**
 * Start the price engine (called once on server boot).
 * Will wait for a token to be set via POST /set-token.
 */
async function start() {
  const protoPath = path.join(__dirname, "..", "MarketDataFeed.proto");
  const root = await protobuf.load(protoPath);
  FeedResponse = root.lookupType("FeedResponse");
  logger.success("Proto schema loaded");

  if (!accessToken) {
    logger.warn("Token not set — waiting for POST /api/set-token");
    return;
  }

  await connectFeed();
}

/**
 * Stop the WebSocket cleanly.
 */
function stop() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }
  logger.info("Price engine stopped");
}

/* ── Internals ── */

async function restart() {
  stop();
  await connectFeed();
}

async function connectFeed() {
  if (!accessToken) return;

  try {
    // 1. Load snapshot LTP via REST
    await loadSnapshot();

    // 2. Authorize WS v3
    const authRes = await axios.get(
      "https://api.upstox.com/v3/feed/market-data-feed/authorize",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const wsUrl = authRes.data.data.authorized_redirect_uri;
    logger.success("WS authorized");

    // 3. Open WebSocket
    ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      logger.success("Upstox WS connected");
      reconnectAttempts = 0;

      const instrumentKeys = Object.values(SYMBOL_MAP);
      ws.send(
        JSON.stringify({
          guid: "paper-trading",
          method: "sub",
          data: { mode: "ltp", instrumentKeys },
        })
      );
    });

    ws.on("message", (buffer) => {
      try {
        const decoded = FeedResponse.decode(buffer);
        const obj = FeedResponse.toObject(decoded);
        if (!obj.feeds) return;

        for (const key of Object.keys(obj.feeds)) {
          const feed = obj.feeds[key];
          if (!feed.ltpc) continue;

          const symbol = INSTRUMENT_TO_SYMBOL[key];
          if (symbol) {
            priceCache.set(symbol, feed.ltpc.ltp);
          }
        }

        logger.price("LIVE:", priceCache.getAll());
      } catch (_) {
        // heartbeat or non-data packet — ignore
      }
    });

    ws.on("close", () => {
      logger.warn("WS closed");
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      logger.error("WS error:", err.message);
    });
  } catch (err) {
    logger.error(
      "WS init failed:",
      err.response?.data || err.message
    );
    scheduleReconnect();
  }
}

async function loadSnapshot() {
  try {
    const instrumentKeys = Object.values(SYMBOL_MAP).join(",");
    const res = await axios.get(
      "https://api.upstox.com/v2/market-quote/ltp",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { instrument_key: instrumentKeys },
      }
    );

    const data = res.data.data;

    for (const [symbol, instrumentKey] of Object.entries(SYMBOL_MAP)) {
      // REST API returns colon-separated keys (NSE_INDEX:Nifty 50)
      const restKey = instrumentKey.replace("|", ":");
      const price = data[restKey]?.last_price || null;
      if (price) priceCache.set(symbol, price);
    }

    logger.success("Snapshot loaded:", priceCache.getAll());
  } catch (err) {
    logger.error("Snapshot error:", err.response?.data || err.message);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  logger.info(`Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectFeed();
  }, delay);
}

module.exports = { start, stop, setToken, getToken, SYMBOL_MAP };
