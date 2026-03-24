const priceCache = require("../utils/priceCache");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/price/:symbol
 */
const getPrice = asyncHandler(async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const price = priceCache.get(symbol);

  res.json({
    symbol,
    price,
    available: price !== null,
  });
});

/**
 * GET /api/prices
 * Returns all cached prices.
 */
const getAllPrices = asyncHandler(async (req, res) => {
  res.json({
    prices: priceCache.getAll(),
  });
});

module.exports = { getPrice, getAllPrices };
