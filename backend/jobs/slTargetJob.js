const { query } = require("../db/mysql");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const logger = require("../utils/logger");
const socketService = require("../services/socketService");

let intervalId = null;

/**
 * Start the SL/Target monitoring job.
 * Checks every `intervalMs` milliseconds for positions that have hit
 * their target or stoploss, and auto-closes them.
 */
function startSlTargetJob(intervalMs = 1500) {
  logger.info(`SL/Target job started (interval: ${intervalMs}ms)`);

  intervalId = setInterval(async () => {
    try {
      if (!isMarketOpen()) return;

      const openPositions = await query(
        "SELECT * FROM positions WHERE status = 'OPEN'"
      );

      if (!openPositions || openPositions.length === 0) return;

      for (const pos of openPositions) {
        const price = priceCache.get(pos.symbol);
        if (!price) continue;

        let exitReason = null;

        if (pos.target && price >= parseFloat(pos.target)) {
          exitReason = "TARGET_HIT";
        } else if (pos.stoploss && price <= parseFloat(pos.stoploss)) {
          exitReason = "STOPLOSS_HIT";
        }

        if (!exitReason) continue;

        logger.trade(
          `${exitReason}: ${pos.symbol} @ ${price} (entry: ${pos.avg_price})`
        );

        // 1. Close position
        await query("UPDATE positions SET status = 'CLOSED' WHERE id = ?", [
          pos.id,
        ]);

        // 2. Calculate PnL & return proceeds
        const avgPrice = parseFloat(pos.avg_price);
        const pnl = (price - avgPrice) * pos.qty;
        const proceeds = price * pos.qty;

        // 3. Update wallet
        await query(
          "UPDATE wallets SET balance = balance + ? WHERE user_id = ?",
          [proceeds, pos.user_id]
        );

        // 4. Insert trade record
        await query(
          `INSERT INTO trades (user_id, symbol, qty, entry_price, exit_price, pnl, side, exit_reason, instrument_key, option_type, strike, expiry)
           VALUES (?, ?, ?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?)`,
          [pos.user_id, pos.symbol, pos.qty, avgPrice, price, pnl, exitReason, pos.instrument_key, pos.option_type, pos.strike, pos.expiry]
        );

        // 5. Record transaction
        await query(
          "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)",
          [
            pos.user_id,
            exitReason,
            proceeds,
            `${exitReason} ${pos.symbol} x${pos.qty} @ ${price} | PnL: ${pnl.toFixed(2)}`,
          ]
        );

        logger.success(
          `Auto-closed ${pos.symbol} | Reason: ${exitReason} | PnL: ${pnl.toFixed(2)}`
        );

        // 6. Emit order update via Socket.IO
        socketService.emitOrderUpdate(pos.user_id, {
          type: exitReason,
          symbol: pos.symbol,
          qty: pos.qty,
          exitPrice: price,
          pnl,
          positionId: pos.id,
        });
      }
    } catch (err) {
      logger.error("SL/Target job error:", err.message);
    }
  }, intervalMs);
}

function stopSlTargetJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("SL/Target job stopped");
  }
}

module.exports = { startSlTargetJob, stopSlTargetJob };
