const { placeLimitOrder, getUserPendingOrders } = require("../services/limitOrderService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * POST /api/orders/limit
 * Body: { symbol, qty, limit_price, side?, target?, stoploss? }
 * User ID from JWT (req.user.id)
 */
const createLimitOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { symbol, qty, limit_price, side, target, stoploss, instrument_key, option_type, strike, expiry } = req.body;

  if (!symbol || !qty || !limit_price) {
    return res.status(400).json({
      success: false,
      message: "symbol, qty, and limit_price are required",
    });
  }

  const result = await placeLimitOrder(
    userId,
    symbol.toUpperCase(),
    qty,
    limit_price,
    side || "BUY",
    target,
    stoploss,
    instrument_key,
    option_type,
    strike,
    expiry
  );

  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * GET /api/orders/pending
 * User ID from JWT (req.user.id)
 */
const getLimitOrders = asyncHandler(async (req, res) => {
  const result = await getUserPendingOrders(req.user.id);
  res.json(result);
});

module.exports = { createLimitOrder, getLimitOrders };
