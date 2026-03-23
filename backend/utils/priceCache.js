/**
 * Redis-ready price cache abstraction.
 * Currently backed by an in-memory Map.
 * Replace internals with Redis client for horizontal scaling.
 */

class PriceCache {
  constructor() {
    this._store = new Map();
  }

  get(symbol) {
    return this._store.get(symbol) || null;
  }

  set(symbol, price) {
    this._store.set(symbol, price);
  }

  getAll() {
    const result = {};
    for (const [key, value] of this._store) {
      result[key] = value;
    }
    return result;
  }

  has(symbol) {
    return this._store.has(symbol) && this._store.get(symbol) !== null;
  }

  clear() {
    this._store.clear();
  }
}

// Singleton instance
const priceCache = new PriceCache();

module.exports = priceCache;
