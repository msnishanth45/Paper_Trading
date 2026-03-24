const { getOptionChainStrikes, getAvailableExpiries } = require("../services/instrumentResolver");
const priceEngine = require("../engines/priceEngine");
const priceCache = require("../utils/priceCache");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/options/chain?symbol=NIFTY&expiry=YYYY-MM-DD
 * Returns option chain with ATM calculated from FUTURES price.
 */
const getOptionChain = asyncHandler(async (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();
  const expiry = req.query.expiry || null;

  if (!symbol || (symbol !== "NIFTY" && symbol !== "BANKNIFTY")) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid index symbol (NIFTY or BANKNIFTY).",
    });
  }

  // Use FUTURES price for ATM calculation (not index price)
  const futSymbol = `${symbol}_FUT`;
  const futuresLtp = priceCache.get(futSymbol);
  const indexLtp = priceCache.get(symbol);

  // Prefer futures LTP, fall back to index
  const atmLtp = futuresLtp || indexLtp;

  if (!atmLtp) {
    return res.status(503).json({
      success: false,
      message: `Price for ${symbol} is not yet available. Waiting for market feed.`,
    });
  }

  // Generate ATM ± 20 levels of strikes
  const result = getOptionChainStrikes(symbol, atmLtp, 20, expiry);

  if (!result.instruments || result.instruments.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No option instruments found for ${symbol}. Is the instrument resolver fully loaded?`,
    });
  }

  // Build instrument keys and mapping for WS subscription
  const optionsKeysToSubscribe = [];
  const symbolMapping = {};
  const structuredChain = {};

  for (const opt of result.instruments) {
    optionsKeysToSubscribe.push(opt.instrumentKey);
    symbolMapping[opt.tradingSymbol] = opt.instrumentKey;

    // Structure the data: grouped by Strike Price -> CE and PE
    if (!structuredChain[opt.strike]) {
      structuredChain[opt.strike] = {
        strike: opt.strike,
        type: opt.type,
      };
    }

    const livePrice = priceCache.get(opt.tradingSymbol) || null;
    const oi = priceCache.getOI(opt.tradingSymbol) || null;

    structuredChain[opt.strike][opt.optionType] = {
      tradingSymbol: opt.tradingSymbol,
      instrumentKey: opt.instrumentKey,
      ltp: livePrice,
      oi: oi,
      lotSize: opt.lotSize,
    };

    // Update type: if this strike is ATM, mark the row
    if (opt.type === "ATM") {
      structuredChain[opt.strike].type = "ATM";
    }
  }

  // Determine ITM/OTM for each row based on both CE and PE perspectives
  for (const strikeKey of Object.keys(structuredChain)) {
    const row = structuredChain[strikeKey];
    const strike = row.strike;

    if (row.type !== "ATM") {
      if (strike < result.atmStrike) {
        // Below ATM: CE is ITM, PE is OTM
        row.type = "ITM_CE";
      } else {
        // Above ATM: PE is ITM, CE is OTM
        row.type = "ITM_PE";
      }
    }
  }

  // Replace subscription for clean rotation
  priceEngine.replaceSubscription(optionsKeysToSubscribe, symbolMapping);

  // Return formatted array sorted by strike
  const sortedChain = Object.values(structuredChain).sort((a, b) => a.strike - b.strike);

  res.json({
    success: true,
    data: {
      underlying: symbol,
      futuresLtp: futuresLtp || null,
      indexLtp: indexLtp || null,
      atmStrike: result.atmStrike,
      expiry: result.expiry,
      chain: sortedChain,
    },
  });
});

/**
 * GET /api/options/expiries?symbol=NIFTY
 * Returns all available expiry dates for a symbol.
 */
const getExpiries = asyncHandler(async (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();

  if (!symbol || (symbol !== "NIFTY" && symbol !== "BANKNIFTY")) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid index symbol (NIFTY or BANKNIFTY).",
    });
  }

  const expiries = getAvailableExpiries(symbol);

  if (expiries.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No expiries found for ${symbol}. Instrument resolver may not be loaded yet.`,
    });
  }

  res.json({
    success: true,
    data: {
      symbol,
      expiries,
      nearestWeekly: expiries[0] || null,
    },
  });
});

module.exports = { getOptionChain, getExpiries };
