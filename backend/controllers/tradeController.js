const { query } = require("../db/mysql");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/trades/:id
 * Returns full detail for a specific trade.
 */
const getTradeDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const trades = await query(
    "SELECT * FROM trades WHERE id = ? AND user_id = ?",
    [id, userId]
  );

  if (trades.length === 0) {
    return res.status(404).json({
      success: false,
      message: "Trade not found",
    });
  }

  const trade = trades[0];

  res.json({
    success: true,
    data: {
      id: trade.id,
      symbol: trade.symbol,
      instrument_key: trade.instrument_key || null,
      option_type: trade.option_type || null,
      strike: trade.strike ? parseFloat(trade.strike) : null,
      expiry: trade.expiry || null,
      qty: trade.qty,
      entryPrice: parseFloat(trade.entry_price),
      exitPrice: parseFloat(trade.exit_price),
      pnl: parseFloat(trade.pnl),
      side: trade.side || "BUY",
      exitReason: trade.exit_reason || "MANUAL",
      entryTime: trade.created_at,
      exitTime: trade.created_at, // trades table records at exit time
    },
  });
});

/**
 * GET /api/trades
 * Returns all trades for the user with optional filters.
 */
const getAllTrades = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { symbol, option_type, limit = 50, offset = 0 } = req.query;

  let sql = "SELECT * FROM trades WHERE user_id = ?";
  const params = [userId];

  if (symbol) {
    sql += " AND symbol LIKE ?";
    params.push(`%${symbol.toUpperCase()}%`);
  }

  if (option_type) {
    sql += " AND option_type = ?";
    params.push(option_type.toUpperCase());
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  const trades = await query(sql, params);

  res.json({
    success: true,
    count: trades.length,
    trades: trades.map((t) => ({
      ...t,
      entry_price: parseFloat(t.entry_price),
      exit_price: parseFloat(t.exit_price),
      pnl: parseFloat(t.pnl),
      strike: t.strike ? parseFloat(t.strike) : null,
    })),
  });
});

module.exports = { getTradeDetail, getAllTrades };
