/* ═══════════════════════════════════════════════════
   Price Cache — Production-Grade Singleton
   Tracks prices, OI, timestamps, and feed health.
   Optional Redis layer via REDIS_URL env var.
   ═══════════════════════════════════════════════════ */

const { REDIS_URL } = require("../config/env");
const logger = require("./logger");

let redisClient = null;

class PriceCache {
  constructor() {
    this._store = new Map();        // symbol → price
    this._timestamps = new Map();   // symbol → lastTickAt (ms)
    this._oiStore = new Map();      // symbol → open interest
    this._startedAt = Date.now();
    this._totalTicks = 0;
    this._feedConnected = false;

    this._initRedis();
  }

  /* ── Redis Setup ── */

  async _initRedis() {
    if (!REDIS_URL) return;

    try {
      const Redis = require("ioredis");
      redisClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 500,
        lazyConnect: true,
      });

      await redisClient.connect();
      logger.success("[CACHE] Redis connected");
    } catch (err) {
      logger.warn(`[CACHE] Redis unavailable, using in-memory: ${err.message}`);
      redisClient = null;
    }
  }

  /* ── Core Methods ── */

  get(symbol) {
    return this._store.get(symbol) || null;
  }

  set(symbol, price) {
    this._store.set(symbol, price);
    this._timestamps.set(symbol, Date.now());
    this._totalTicks++;

    // Phase 8: Redis Pub/Sub & 5-min TTL
    if (redisClient) {
      const payload = JSON.stringify({ price, ts: Date.now() });
      redisClient.setex(`price:${symbol}`, 300, payload).catch(() => {});
      redisClient.publish("price_updates", JSON.stringify({ symbol, price })).catch(() => {});
    }
  }

  getAll() {
    const result = {};
    for (const [key, value] of this._store) {
      result[key] = value;
    }
    return result;
  }

  getAllWithTimestamps() {
    const result = {};
    for (const [key, value] of this._store) {
      result[key] = {
        price: value,
        lastTickAt: this._timestamps.get(key) || null,
        stale: this._isStale(key),
      };
    }
    return result;
  }

  has(symbol) {
    return this._store.has(symbol) && this._store.get(symbol) !== null;
  }

  clear() {
    this._store.clear();
    this._timestamps.clear();
    this._oiStore.clear();
    if (redisClient) {
      redisClient.del("prices").catch(() => {});
    }
  }

  /* ── Open Interest Methods ── */

  setOI(symbol, oi) {
    this._oiStore.set(symbol, oi);
  }

  getOI(symbol) {
    return this._oiStore.get(symbol) || null;
  }

  getAllOI() {
    const result = {};
    for (const [key, value] of this._oiStore) {
      result[key] = value;
    }
    return result;
  }

  /* ── Feed Status ── */

  setFeedConnected(connected) {
    this._feedConnected = connected;
  }

  getFeedStatus() {
    const symbols = {};
    for (const [key, value] of this._store) {
      symbols[key] = {
        price: value,
        oi: this._oiStore.get(key) || null,
        lastTickAt: this._timestamps.get(key) || null,
        stale: this._isStale(key),
        age: this._timestamps.has(key)
          ? `${((Date.now() - this._timestamps.get(key)) / 1000).toFixed(1)}s`
          : "never",
      };
    }

    return {
      connected: this._feedConnected,
      symbolCount: this._store.size,
      totalTicks: this._totalTicks,
      uptimeSeconds: Math.floor((Date.now() - this._startedAt) / 1000),
      redisConnected: redisClient !== null,
      symbols,
    };
  }

  /* ── Helpers ── */

  _isStale(symbol) {
    const ts = this._timestamps.get(symbol);
    if (!ts) return true;
    // Consider stale if no tick for 30 seconds
    return Date.now() - ts > 30000;
  }

  getLastTickTime(symbol) {
    return this._timestamps.get(symbol) || null;
  }

  getLastTickTimeAny() {
    let latest = 0;
    for (const ts of this._timestamps.values()) {
      if (ts > latest) latest = ts;
    }
    return latest || null;
  }
}

// Singleton instance
const priceCache = new PriceCache();

module.exports = priceCache;
