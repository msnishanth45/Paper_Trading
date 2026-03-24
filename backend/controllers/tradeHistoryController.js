const { query } = require("../db/mysql");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/portfolio/history
 * (Kept for backward compat — main handler is in portfolioController now)
 */
const getTradeHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const trades = await query(
    "SELECT * FROM trades WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );

  const totalPnL = trades.reduce(
    (sum, t) => sum + (parseFloat(t.pnl) || 0),
    0
  );
  const winners = trades.filter((t) => parseFloat(t.pnl) > 0).length;
  const losers = trades.filter((t) => parseFloat(t.pnl) < 0).length;

  res.json({
    success: true,
    summary: {
      totalTrades: trades.length,
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      winners,
      losers,
      winRate:
        trades.length > 0
          ? parseFloat(((winners / trades.length) * 100).toFixed(2))
          : 0,
    },
    trades,
  });
});

module.exports = { getTradeHistory };
