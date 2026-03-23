const supabase = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/trade-history/:userId
 * Returns closed trades sorted by exit_time desc.
 */
const getTradeHistory = asyncHandler(async (req, res) => {
  const userId = req.params.userId;

  const { data: trades, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("exit_time", { ascending: false });

  if (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch trades" });
  }

  // Calculate summary stats
  const totalPnL = trades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
  const winners = trades.filter((t) => parseFloat(t.pnl) > 0).length;
  const losers = trades.filter((t) => parseFloat(t.pnl) < 0).length;

  res.json({
    success: true,
    summary: {
      totalTrades: trades.length,
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      winners,
      losers,
      winRate: trades.length > 0 ? parseFloat(((winners / trades.length) * 100).toFixed(2)) : 0,
    },
    trades,
  });
});

module.exports = { getTradeHistory };
