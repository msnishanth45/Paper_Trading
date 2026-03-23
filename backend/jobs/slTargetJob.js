const supabase = require("../config/supabase");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const logger = require("../utils/logger");

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

      const { data: openPositions, error } = await supabase
        .from("positions")
        .select("*")
        .eq("status", "OPEN");

      if (error || !openPositions || openPositions.length === 0) return;

      for (const pos of openPositions) {
        const price = priceCache.get(pos.symbol);
        if (!price) continue;

        let exitReason = null;

        if (pos.target && price >= pos.target) {
          exitReason = "TARGET_HIT";
        } else if (pos.stoploss && price <= pos.stoploss) {
          exitReason = "STOPLOSS_HIT";
        }

        if (!exitReason) continue;

        logger.trade(`${exitReason}: ${pos.symbol} @ ${price} (entry: ${pos.avg_price})`);

        // 1. Close position
        await supabase
          .from("positions")
          .update({ status: "CLOSED" })
          .eq("id", pos.id);

        // 2. Calculate PnL & return proceeds
        const pnl = (price - pos.avg_price) * pos.qty;
        const proceeds = price * pos.qty;

        const { data: user } = await supabase
          .from("users")
          .select("balance")
          .eq("id", pos.user_id)
          .single();

        if (user) {
          await supabase
            .from("users")
            .update({ balance: user.balance + proceeds })
            .eq("id", pos.user_id);
        }

        // 3. Insert trade record
        await supabase.from("trades").insert([
          {
            user_id: pos.user_id,
            symbol: pos.symbol,
            qty: pos.qty,
            entry_price: pos.avg_price,
            exit_price: price,
            pnl,
            side: "BUY",
          },
        ]);

        logger.success(
          `Auto-closed ${pos.symbol} | Reason: ${exitReason} | PnL: ${pnl.toFixed(2)}`
        );
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
