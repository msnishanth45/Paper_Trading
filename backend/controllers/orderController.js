const { executeBuy, executeSell } = require("../services/orderService");
const { query } = require("../db/mysql");
const asyncHandler = require("../utils/asyncHandler");

/**
 * POST /api/orders/buy
 * Body: { symbol, qty, target?, stoploss? }
 * User ID from JWT (req.user.id)
 */
const buyOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { symbol, qty, target, stoploss, instrument_key, option_type, strike, expiry } = req.body;

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
    expiry
  );
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * POST /api/orders/sell
 * Body: { position_id }
 * User ID from JWT (req.user.id)
 */
const sellOrder = asyncHandler(async (req, res) => {
  const { position_id } = req.body;
  const userId = req.user.id;

  if (!position_id) {
    return res
      .status(400)
      .json({ success: false, message: "position_id is required" });
  }

  const result = await executeSell(userId, position_id);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * GET /api/orders/open
 * Returns all open positions for the authenticated user.
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
 * PATCH /api/orders/:id
 * Updates target and/or stoploss for an open position/order.
 */
const modifyOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { target, stoploss } = req.body;
  const userId = req.user.id;

  // Verify the position belongs to the user and is OPEN
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

  // Update position
  await query(
    "UPDATE positions SET target = ?, stoploss = ? WHERE id = ?",
    [target || null, stoploss || null, id]
  );

  res.json({
    success: true,
    message: "Order parameters updated successfully",
    data: {
      id,
      target: target || null,
      stoploss: stoploss || null,
    },
  });
});

module.exports = { buyOrder, sellOrder, getOpenPositions, modifyOrder };
