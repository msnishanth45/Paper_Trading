const { query } = require("../db/mysql");
const priceCache = require("../utils/priceCache");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/portfolio/positions
 * Returns open positions with live P&L for the authenticated user.
 */
const getPositions = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const positions = await query(
    "SELECT * FROM positions WHERE user_id = ? AND status = 'OPEN' ORDER BY created_at DESC",
    [userId]
  );

  const enriched = positions.map((pos) => {
    const ltp = priceCache.get(pos.symbol);
    const avgPrice = parseFloat(pos.avg_price);
    const posInvested = avgPrice * pos.qty;
    const posCurrent = ltp ? ltp * pos.qty : posInvested;
    const posPnL = ltp ? (ltp - avgPrice) * pos.qty : 0;

    return {
      ...pos,
      avg_price: avgPrice,
      ltp: ltp || null,
      currentValue: parseFloat(posCurrent.toFixed(2)),
      unrealizedPnL: parseFloat(posPnL.toFixed(2)),
    };
  });

  res.json({
    success: true,
    count: enriched.length,
    positions: enriched,
  });
});

/**
 * GET /api/portfolio/pnl
 * Returns unrealized P&L, invested value, current value, ROI%.
 */
const getPnL = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const positions = await query(
    "SELECT * FROM positions WHERE user_id = ? AND status = 'OPEN'",
    [userId]
  );

  if (!positions || positions.length === 0) {
    return res.json({
      success: true,
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
    const avgPrice = parseFloat(pos.avg_price);
    const posInvested = avgPrice * pos.qty;
    const posCurrent = ltp ? ltp * pos.qty : posInvested;
    const posPnL = ltp ? (ltp - avgPrice) * pos.qty : 0;

    totalPnL += posPnL;
    invested += posInvested;
    currentValue += posCurrent;

    return {
      ...pos,
      avg_price: avgPrice,
      ltp: ltp || null,
      unrealizedPnL: parseFloat(posPnL.toFixed(2)),
    };
  });

  res.json({
    success: true,
    totalPnL: parseFloat(totalPnL.toFixed(2)),
    invested: parseFloat(invested.toFixed(2)),
    currentValue: parseFloat(currentValue.toFixed(2)),
    roi:
      invested > 0
        ? parseFloat(((totalPnL / invested) * 100).toFixed(2))
        : 0,
    positions: enriched,
  });
});

/**
 * GET /api/portfolio/history
 * Returns closed trades sorted by created_at desc with summary stats.
 */
const getHistory = asyncHandler(async (req, res) => {
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

module.exports = { getPositions, getPnL, getHistory };
