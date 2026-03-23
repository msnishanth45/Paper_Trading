/* ═══════════════════════════════════════════════════
   Instrument Resolver — Dynamic Futures Discovery
   Downloads Upstox NSE_FO CSV and finds nearest
   expiry NIFTY & BANKNIFTY futures contracts.
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
        // Handle gzip automatically via axios
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

  logger.info(`[RESOLVER] Parsed ${records.length} instrument rows`);
  return records;
}

/**
 * Find the nearest expiry futures contract for a given underlying symbol.
 * @param {Array} instruments - Parsed CSV rows
 * @param {string} symbol - e.g. "NIFTY", "BANKNIFTY"
 * @returns {{ instrumentKey: string, expiry: string, tradingSymbol: string } | null}
 */
function findNearestFuture(instruments, symbol) {
  const now = new Date();

  // Filter futures for this symbol
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

  // Sort by expiry date ascending, pick the nearest one that hasn't expired
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
 * Returns { symbolMap, instrumentKeys, instrumentToSymbol }
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

    // Use fallback hardcoded keys
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

module.exports = { resolveInstruments, INDEX_KEYS, FUTURES_SYMBOLS };
