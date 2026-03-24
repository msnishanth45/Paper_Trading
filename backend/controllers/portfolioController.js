const { query } = require("../db/mysql");
const priceCache = require("../utils/priceCache");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/portfolio/positions
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

/**
 * GET /api/portfolio/summary
 * Comprehensive trading performance summary.
 */
const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Realized PnL from closed trades
  const trades = await query(
    "SELECT pnl, entry_price, exit_price, qty FROM trades WHERE user_id = ?",
    [userId]
  );

  // Unrealized PnL from open positions
  const openPositions = await query(
    "SELECT symbol, qty, avg_price FROM positions WHERE user_id = ? AND status = 'OPEN'",
    [userId]
  );

  // Realized stats
  const totalRealizedPnl = trades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
  const winners = trades.filter((t) => parseFloat(t.pnl) > 0);
  const losers = trades.filter((t) => parseFloat(t.pnl) < 0);
  const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;

  const avgProfit = winners.length > 0
    ? winners.reduce((sum, t) => sum + parseFloat(t.pnl), 0) / winners.length
    : 0;

  const avgLoss = losers.length > 0
    ? losers.reduce((sum, t) => sum + parseFloat(t.pnl), 0) / losers.length
    : 0;

  // Unrealized stats
  let unrealizedPnl = 0;
  let totalInvested = 0;
  let totalCurrentValue = 0;

  for (const pos of openPositions) {
    const ltp = priceCache.get(pos.symbol);
    const avgPrice = parseFloat(pos.avg_price);
    const invested = avgPrice * pos.qty;
    const current = ltp ? ltp * pos.qty : invested;

    totalInvested += invested;
    totalCurrentValue += current;
    unrealizedPnl += current - invested;
  }

  const totalPnl = totalRealizedPnl + unrealizedPnl;

  // Wallet balance
  const wallets = await query("SELECT balance FROM wallets WHERE user_id = ?", [userId]);
  const walletBalance = wallets.length > 0 ? parseFloat(wallets[0].balance) : 0;

  // ROI based on initial capital (100000)
  const initialCapital = 100000;
  const roi = ((walletBalance + totalCurrentValue - initialCapital) / initialCapital) * 100;

  res.json({
    success: true,
    data: {
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      realizedPnl: parseFloat(totalRealizedPnl.toFixed(2)),
      unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
      totalTrades: trades.length,
      winners: winners.length,
      losers: losers.length,
      winRate: parseFloat(winRate.toFixed(2)),
      avgProfit: parseFloat(avgProfit.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      runningPositions: openPositions.length,
      invested: parseFloat(totalInvested.toFixed(2)),
      currentValue: parseFloat(totalCurrentValue.toFixed(2)),
      walletBalance: parseFloat(walletBalance.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
    },
  });
});

module.exports = { getPositions, getPnL, getHistory, getSummary };
