const { placeLimitOrder, getUserPendingOrders } = require("../services/limitOrderService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * POST /api/limit-order
 * Body: { user_id, symbol, qty, limit_price, side?, target?, stoploss? }
 */
const createLimitOrder = asyncHandler(async (req, res) => {
  const { user_id, symbol, qty, limit_price, side, target, stoploss } = req.body;

  if (!user_id || !symbol || !qty || !limit_price) {
    return res.status(400).json({
      success: false,
      message: "user_id, symbol, qty, and limit_price are required",
    });
  }

  const result = await placeLimitOrder(
    user_id,
    symbol.toUpperCase(),
    qty,
    limit_price,
    side || "BUY",
    target,
    stoploss
  );

  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * GET /api/limit-orders/:userId
 */
const getLimitOrders = asyncHandler(async (req, res) => {
  const result = await getUserPendingOrders(req.params.userId);
  res.json(result);
});

module.exports = { createLimitOrder, getLimitOrders };
