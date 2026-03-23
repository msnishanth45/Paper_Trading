const { getMarketInfo } = require("../utils/marketStatus");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/market-status
 */
const getMarketStatus = asyncHandler(async (req, res) => {
  res.json(getMarketInfo());
});

module.exports = { getMarketStatus };
