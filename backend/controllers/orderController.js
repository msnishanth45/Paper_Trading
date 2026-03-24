const { executeBuy, executeSell, executeOptionBuy, executeOptionSell, cancelOrder } = require("../services/orderService");
const { query } = require("../db/mysql");
const asyncHandler = require("../utils/asyncHandler");

/**
 * POST /api/orders/buy
 * Body: { symbol, qty, target?, stoploss?, trailing_sl? }
 */
const buyOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { symbol, qty, target, stoploss, trailing_sl, instrument_key, option_type, strike, expiry } = req.body;

  if (!symbol || !qty) {
    return res
      .status(400)
      .json({ success: false, message: "symbol and qty are required" });
  }

  const result = await executeBuy(
    userId,
    symbol.toUpperCase(),
    qty,
    target,
    stoploss,
    instrument_key,
    option_type,
    strike,
    expiry,
    trailing_sl
  );
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * POST /api/orders/sell
 * Body: { position_id, qty? }
 */
const sellOrder = asyncHandler(async (req, res) => {
  const { position_id, qty } = req.body;
  const userId = req.user.id;

  if (!position_id) {
    return res
      .status(400)
      .json({ success: false, message: "position_id is required" });
  }

  const result = await executeSell(userId, position_id, qty || null);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * POST /api/orders/option-buy
 * Body: { symbol, qty, instrument_key, option_type, strike, expiry, target?, stoploss?, trailing_sl?, order_type?, limit_price? }
 */
const optionBuyOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await executeOptionBuy(userId, req.body);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * POST /api/orders/option-sell
 * Body: { position_id, qty?, exit_type? }
 */
const optionSellOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await executeOptionSell(userId, req.body);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * GET /api/orders/open
 */
const getOpenPositions = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const positions = await query(
    "SELECT * FROM positions WHERE user_id = ? AND status = 'OPEN' ORDER BY created_at DESC",
    [userId]
  );

  res.json({
    success: true,
    positions,
  });
});

/**
 * PATCH /api/orders/:id/modify
 * Updates target, stoploss, and/or trailing_sl for an open position.
 */
const modifyOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { target, stoploss, trailing_sl } = req.body;
  const userId = req.user.id;

  const positions = await query(
    "SELECT * FROM positions WHERE id = ? AND user_id = ? AND status = 'OPEN'",
    [id, userId]
  );

  if (positions.length === 0) {
    return res.status(404).json({
      success: false,
      message: "Open position not found or not editable",
    });
  }

  await query(
    "UPDATE positions SET target = ?, stoploss = ?, trailing_sl = ? WHERE id = ?",
    [target || null, stoploss || null, trailing_sl || null, id]
  );

  res.json({
    success: true,
    message: "Order parameters updated successfully",
    data: {
      id: parseInt(id),
      target: target || null,
      stoploss: stoploss || null,
      trailing_sl: trailing_sl || null,
    },
  });
});

/**
 * DELETE /api/orders/:id/cancel
 * Cancel a pending order.
 */
const cancelOrderController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await cancelOrder(userId, parseInt(id));
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

module.exports = { buyOrder, sellOrder, optionBuyOrder, optionSellOrder, getOpenPositions, modifyOrder, cancelOrderController };
