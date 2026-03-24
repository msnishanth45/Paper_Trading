const priceEngine = require("../engines/priceEngine");
const priceCache = require("../utils/priceCache");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/feed-status
 * Returns WebSocket state, tracked instruments, last tick timestamps, uptime.
 */
const getFeedStatus = asyncHandler(async (req, res) => {
  const status = priceEngine.getStatus();

  res.json({
    success: true,
    ...status,
  });
});

module.exports = { getFeedStatus };
