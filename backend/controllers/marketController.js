const { isMarketOpen } = require("../utils/marketStatus");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/market/status
 */
const getMarketStatus = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    isOpen: isMarketOpen(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = { getMarketStatus };
