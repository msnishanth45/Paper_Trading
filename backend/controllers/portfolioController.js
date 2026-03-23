const supabase = require("../config/supabase");
const priceCache = require("../utils/priceCache");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/pnl/:userId
 * Returns unrealized P&L, invested value, current value, ROI%.
 */
const getPnL = asyncHandler(async (req, res) => {
  const userId = req.params.userId;

  const { data: positions, error } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "OPEN");

  if (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch positions" });
  }

  if (!positions || positions.length === 0) {
    return res.json({
      totalPnL: 0,
      invested: 0,
      currentValue: 0,
      roi: 0,
      positions: [],
    });
  }

  let totalPnL = 0;
  let invested = 0;
  let currentValue = 0;

  const enriched = positions.map((pos) => {
    const ltp = priceCache.get(pos.symbol);
    const posInvested = pos.avg_price * pos.qty;
    const posCurrent = ltp ? ltp * pos.qty : posInvested;
    const posPnL = ltp ? (ltp - pos.avg_price) * pos.qty : 0;

    totalPnL += posPnL;
    invested += posInvested;
    currentValue += posCurrent;

    return {
      ...pos,
      ltp: ltp || null,
      unrealizedPnL: parseFloat(posPnL.toFixed(2)),
    };
  });

  res.json({
    totalPnL: parseFloat(totalPnL.toFixed(2)),
    invested: parseFloat(invested.toFixed(2)),
    currentValue: parseFloat(currentValue.toFixed(2)),
    roi: invested > 0 ? parseFloat(((totalPnL / invested) * 100).toFixed(2)) : 0,
    positions: enriched,
  });
});

module.exports = { getPnL };
