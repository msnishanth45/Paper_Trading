/* ═══════════════════════════════════════════════════
   Instrument Resolver — Dynamic Futures & Options Discovery
   Downloads Upstox NSE_FO CSV, finds nearest expiry
   futures, and builds option chain data with expiry
   management and in-memory caching.
   ═══════════════════════════════════════════════════ */

const axios = require("axios");
const { parse } = require("csv-parse/sync");
const logger = require("../utils/logger");

const INSTRUMENTS_URL =
  "https://assets.upstox.com/market-quote/instruments/exchange/NSE_FO.csv.gz";

const INSTRUMENTS_URL_FALLBACK =
  "https://assets.upstox.com/market-quote/instruments/exchange/NSE_FO.csv";

/* Symbols we care about */
const FUTURES_SYMBOLS = ["NIFTY", "BANKNIFTY"];

/* Index instrument keys (always subscribe to these) */
const INDEX_KEYS = {
  NIFTY: "NSE_INDEX|Nifty 50",
  BANKNIFTY: "NSE_INDEX|Nifty Bank",
  SENSEX: "BSE_INDEX|SENSEX",
};

/* Strike step sizes per underlying */
const STRIKE_STEPS = {
  NIFTY: 50,
  BANKNIFTY: 100,
};

/* Cache the full parsed CSV in memory for option chain lookups */
let instrumentsCache = [];

/* Fallback hardcoded keys in case CSV download fails */
const FALLBACK_KEYS = {
  NIFTY_FUT: "NSE_FO|NIFTY25MARFUT",
  BANKNIFTY_FUT: "NSE_FO|BANKNIFTY25MARFUT",
};

/**
 * Download and parse the NSE_FO instruments CSV.
 * Returns an array of parsed rows.
 */
async function downloadInstruments() {
  let csvText = null;

  // Try uncompressed first (simpler, no zlib needed)
  for (const url of [INSTRUMENTS_URL_FALLBACK, INSTRUMENTS_URL]) {
    try {
      logger.info(`[RESOLVER] Downloading instruments from: ${url}`);
      const res = await axios.get(url, {
        timeout: 30000,
        responseType: "text",
        decompress: true,
      });
      csvText = res.data;
      logger.success(`[RESOLVER] Downloaded instruments CSV (${csvText.length} chars)`);
      break;
    } catch (err) {
      logger.warn(`[RESOLVER] Failed to download from ${url}: ${err.message}`);
    }
  }

  if (!csvText) {
    throw new Error("Failed to download instruments CSV from all sources");
  }

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  instrumentsCache = records; // Cache globally
  logger.info(`[RESOLVER] Parsed ${records.length} instrument rows and cached in memory`);
  return records;
}

/**
 * Find the nearest expiry futures contract for a given underlying symbol.
 */
function findNearestFuture(instruments, symbol) {
  const now = new Date();

  const futures = instruments.filter((row) => {
    const name = (row.name || row.tradingsymbol || "").toUpperCase();
    const instrType = (row.instrument_type || "").toUpperCase();
    const underlying = (row.underlying || row.name || "").toUpperCase();

    return (
      (instrType === "FUT" || instrType === "FUTIDX" || instrType === "FUTSTK") &&
      (underlying === symbol || name.startsWith(symbol))
    );
  });

  if (futures.length === 0) {
    logger.warn(`[RESOLVER] No futures found for ${symbol}`);
    return null;
  }

  const validFutures = futures
    .map((row) => ({
      instrumentKey: row.instrument_key || `NSE_FO|${row.tradingsymbol}`,
      expiry: new Date(row.expiry),
      tradingSymbol: row.tradingsymbol || row.trading_symbol || "",
      lotSize: parseInt(row.lot_size, 10) || 1,
      raw: row,
    }))
    .filter((f) => f.expiry >= now)
    .sort((a, b) => a.expiry - b.expiry);

  if (validFutures.length === 0) {
    logger.warn(`[RESOLVER] All futures expired for ${symbol}`);
    return null;
  }

  const nearest = validFutures[0];
  logger.success(
    `[RESOLVER] ${symbol} → ${nearest.instrumentKey} (expiry: ${nearest.expiry.toISOString().split("T")[0]})`
  );
  return nearest;
}

/**
 * Resolve all instrument keys to subscribe to.
 */
async function resolveInstruments() {
  const symbolMap = {};
  const instrumentToSymbol = {};

  // Always include index keys
  for (const [sym, key] of Object.entries(INDEX_KEYS)) {
    symbolMap[sym] = key;
    instrumentToSymbol[key] = sym;
  }

  try {
    const instruments = await downloadInstruments();

    for (const sym of FUTURES_SYMBOLS) {
      const result = findNearestFuture(instruments, sym);
      if (result) {
        const futKey = `${sym}_FUT`;
        symbolMap[futKey] = result.instrumentKey;
        instrumentToSymbol[result.instrumentKey] = futKey;
      }
    }
  } catch (err) {
    logger.error(`[RESOLVER] CSV download failed, using fallbacks: ${err.message}`);

    for (const [sym, key] of Object.entries(FALLBACK_KEYS)) {
      symbolMap[sym] = key;
      instrumentToSymbol[key] = sym;
    }
  }

  const instrumentKeys = Object.values(symbolMap);

  logger.success(`[RESOLVER] Final instrument map:`);
  for (const [sym, key] of Object.entries(symbolMap)) {
    logger.info(`  ${sym} → ${key}`);
  }

  return { symbolMap, instrumentKeys, instrumentToSymbol };
}

/**
 * Get all available expiry dates for options of a given symbol.
 * Returns sorted array of expiry date strings.
 */
function getAvailableExpiries(symbol) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expirySet = new Set();

  for (const row of instrumentsCache) {
    const instrType = (row.instrument_type || "").toUpperCase();
    const underlying = (row.underlying || row.name || "").toUpperCase();
    const name = (row.name || row.tradingsymbol || "").toUpperCase();

    if (
      (instrType === "OPTIDX" || instrType === "OPTSTK" || instrType === "CE" || instrType === "PE") &&
      (underlying === symbol || name.startsWith(symbol))
    ) {
      if (row.expiry) {
        const expDate = new Date(row.expiry);
        if (expDate >= now) {
          expirySet.add(row.expiry);
        }
      }
    }
  }

  // Sort ascending
  return Array.from(expirySet).sort((a, b) => new Date(a) - new Date(b));
}

/**
 * Get the nearest (weekly) expiry date for options of a given symbol.
 */
function getNearestOptionExpiry(symbol) {
  const expiries = getAvailableExpiries(symbol);
  return expiries.length > 0 ? expiries[0] : null;
}

/**
 * Detect option type from CSV row.
 * Tries: instrument_type field, option_type field, then trading symbol suffix.
 */
function detectOptionType(row) {
  const instrType = (row.instrument_type || "").toUpperCase();
  if (instrType === "CE" || instrType === "PE") return instrType;

  const optType = (row.option_type || "").toUpperCase();
  if (optType === "CE" || optType === "PE") return optType;

  const ts = (row.tradingsymbol || row.trading_symbol || "").toUpperCase();
  if (ts.endsWith("CE")) return "CE";
  if (ts.endsWith("PE")) return "PE";

  return null;
}

/**
 * Generate an Option Chain (ATM ± numLevels) for a symbol at a specific LTP.
 * @param {string} symbol - Underlying symbol (NIFTY, BANKNIFTY)
 * @param {number} ltp - Last traded price (preferably futures LTP)
 * @param {number} numLevels - Number of strikes above and below ATM (default 20)
 * @param {string|null} expiry - Specific expiry date string. If null, uses nearest.
 * @returns {Array} Array of option instrument objects with strike type info
 */
function getOptionChainStrikes(symbol, ltp, numLevels = 20, expiry = null) {
  // Resolve expiry
  const targetExpiry = expiry || getNearestOptionExpiry(symbol);
  if (!targetExpiry) return { instruments: [], atmStrike: 0, expiry: null };

  // Determine strike step
  const step = STRIKE_STEPS[symbol] || 50;
  const atmStrike = Math.round(ltp / step) * step;

  const strikes = [];
  for (let i = -numLevels; i <= numLevels; i++) {
    strikes.push(atmStrike + i * step);
  }

  // Filter cache for these strikes, specific expiry, and symbol
  const chainInstruments = instrumentsCache.filter((row) => {
    const name = (row.name || row.tradingsymbol || "").toUpperCase();
    const underlying = (row.underlying || row.name || "").toUpperCase();
    const instrType = (row.instrument_type || "").toUpperCase();

    return (
      (instrType === "OPTIDX" || instrType === "OPTSTK" || instrType === "CE" || instrType === "PE") &&
      (underlying === symbol || name.startsWith(symbol)) &&
      row.expiry === targetExpiry &&
      strikes.includes(parseFloat(row.strike))
    );
  });

  const instruments = chainInstruments.map((row) => {
    const strike = parseFloat(row.strike);
    const optionType = detectOptionType(row);

    // Determine strike classification
    let type = "OTM";
    if (strike === atmStrike) {
      type = "ATM";
    } else if (optionType === "CE" && strike < atmStrike) {
      type = "ITM";
    } else if (optionType === "PE" && strike > atmStrike) {
      type = "ITM";
    }

    return {
      instrumentKey: row.instrument_key || `NSE_FO|${row.tradingsymbol}`,
      tradingSymbol: row.tradingsymbol || row.trading_symbol,
      strike,
      optionType,
      expiry: row.expiry,
      lotSize: parseInt(row.lot_size, 10) || 1,
      type,
    };
  });

  return { instruments, atmStrike, expiry: targetExpiry };
}

function getCachedInstruments() {
  return instrumentsCache;
}

module.exports = {
  resolveInstruments,
  INDEX_KEYS,
  FUTURES_SYMBOLS,
  STRIKE_STEPS,
  getCachedInstruments,
  getOptionChainStrikes,
  getNearestOptionExpiry,
  getAvailableExpiries,
  detectOptionType,
  downloadInstruments,
};
