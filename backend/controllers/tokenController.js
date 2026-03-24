const priceEngine = require("../engines/priceEngine");
const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");

/**
 * POST /api/set-token
 * Body: { token: "<upstox_access_token>" }
 */
const setToken = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ success: false, message: "Token is required" });
  }

  await priceEngine.setToken(token);

  logger.success("Token set via API");
  res.json({ success: true, message: "Token set, price feed (re)starting" });
});

module.exports = { setToken };
