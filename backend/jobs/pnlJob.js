const { query } = require("../db/mysql");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const socketService = require("../services/socketService");
const logger = require("../utils/logger");

let intervalId = null;

/**
 * Start the Realtime PnL Emit Job.
 * Calculates total invested, current value, and unrealized PnL for
 * all users with open positions, pushing updates directly via Socket.IO.
 */
function startPnlJob(intervalMs = 1000) {
  logger.info(`PnL Emit job started (interval: ${intervalMs}ms)`);

  intervalId = setInterval(async () => {
    try {
      // Don't emit outside market hours unless there's an active session
      if (!isMarketOpen() && socketService.getConnectedCount() === 0) return;

      const openPositions = await query(
        "SELECT user_id, symbol, qty, avg_price FROM positions WHERE status = 'OPEN'"
      );

      if (!openPositions || openPositions.length === 0) return;

      // Group positions by user_id
      const userPortfolios = {};

      for (const pos of openPositions) {
        if (!userPortfolios[pos.user_id]) {
          userPortfolios[pos.user_id] = { invested: 0, current: 0, pnl: 0 };
        }

        const ltp = priceCache.get(pos.symbol) || parseFloat(pos.avg_price); // fallback if no LTP
        const qty = parseInt(pos.qty, 10);
        const avgPrice = parseFloat(pos.avg_price);

        const invested = avgPrice * qty;
        const current = ltp * qty;
        const pnl = current - invested;

        userPortfolios[pos.user_id].invested += invested;
        userPortfolios[pos.user_id].current += current;
        userPortfolios[pos.user_id].pnl += pnl;
      }

      // Emit to each user's specific room
      for (const [userId, totals] of Object.entries(userPortfolios)) {
        socketService.emitPnlUpdate(userId, {
          invested: totals.invested,
          current: totals.current,
          unrealized_pnl: totals.pnl,
        });
      }
    } catch (err) {
      logger.error("PnL Emit job error:", err.message);
    }
  }, intervalMs);
}

function stopPnlJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("PnL Emit job stopped");
  }
}

module.exports = { startPnlJob, stopPnlJob };
