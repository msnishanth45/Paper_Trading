const { getOptionChainStrikes } = require("../services/instrumentResolver");
const priceEngine = require("../engines/priceEngine");
const priceCache = require("../utils/priceCache");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/options/chain?symbol=NIFTY
 */
const getOptionChain = asyncHandler(async (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();

  if (!symbol || (symbol !== "NIFTY" && symbol !== "BANKNIFTY")) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid index symbol (NIFTY or BANKNIFTY).",
    });
  }

  // 1. Get current underlying price
  const ltp = priceCache.get(symbol);
  if (!ltp) {
    return res.status(503).json({
      success: false,
      message: `Underlying price for ${symbol} is not yet available. Please try again in a few seconds.`,
    });
  }

  // 2. Generate ATM ± 10 levels of strikes
  const optionInstruments = getOptionChainStrikes(symbol, ltp, 10);
  
  if (optionInstruments.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No option cache available for ${symbol}. Is the instrument resolver fully loaded?`,
    });
  }

  // 3. Register these keys with the priceEngine so they get live updates from WS
  const optionsKeysToSubscribe = [];
  const symbolMapping = {};

  const structuredChain = {};

  for (const opt of optionInstruments) {
    optionsKeysToSubscribe.push(opt.instrumentKey);
    symbolMapping[opt.tradingSymbol] = opt.instrumentKey;

    // Structure the data: grouped by Strike Price -> CE and PE
    if (!structuredChain[opt.strike]) {
      structuredChain[opt.strike] = { strike: opt.strike };
    }
    
    const livePrice = priceCache.get(opt.tradingSymbol) || null;

    structuredChain[opt.strike][opt.optionType] = {
      tradingSymbol: opt.tradingSymbol,
      instrumentKey: opt.instrumentKey,
      price: livePrice,
      lotSize: opt.lotSize
    };
  }

  // Request price engine to dynamically subscribe
  priceEngine.addSubscription(optionsKeysToSubscribe, symbolMapping);

  // Return formatted array sorted by strike
  const sortedChain = Object.values(structuredChain).sort((a, b) => a.strike - b.strike);

  res.json({
    success: true,
    data: {
      underlying: symbol,
      ltp: ltp,
      chain: sortedChain
    }
  });
});

module.exports = { getOptionChain };
