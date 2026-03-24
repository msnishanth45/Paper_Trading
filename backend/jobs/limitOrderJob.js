const { matchPendingOrders } = require("../services/limitOrderService");
const logger = require("../utils/logger");
const { isMarketOpen } = require("../utils/marketStatus");

let intervalId = null;

/**
 * Start the limit order matching job.
 * Checks every `intervalMs` for pending orders whose limit price has been reached.
 */
function startLimitOrderJob(intervalMs = 2000) {
  logger.info(`Limit order job started (interval: ${intervalMs}ms)`);

  intervalId = setInterval(async () => {
    try {
      await matchPendingOrders();
    } catch (err) {
      logger.error("Limit order job error:", err.message);
    }
  }, intervalMs);
}

function stopLimitOrderJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("Limit order job stopped");
  }
}

module.exports = { startLimitOrderJob, stopLimitOrderJob };
