const { startSlTargetJob } = require("./jobs/slTargetJob");
const { startLimitOrderJob } = require("./jobs/limitOrderJob");
const priceCache = require("./utils/priceCache");
const logger = require("./utils/logger");
const { resolveInstruments } = require("./services/instrumentResolver");

// Receive IPC prices from main process
process.on("message", (msg) => {
  if (msg.type === "PRICE_UPDATE") {
    for (const [symbol, price] of Object.entries(msg.prices)) {
      // Direct memory update to prevent duplicate Redis publishing from the worker
      priceCache._store.set(symbol, price);
      priceCache._timestamps.set(symbol, Date.now());
    }
  }
});

logger.info("[WORKER] Background Process Started");

// CPU-intensive background jobs
startSlTargetJob(1000);
startLimitOrderJob(1000);

// Daily CSV Refresh
setInterval(async () => {
   try {
     logger.info("[WORKER] Running daily CSV refresh...");
     await resolveInstruments();
   } catch(err) {
     logger.error("[WORKER] CSV Refresh failed: " + err.message);
   }
}, 12 * 60 * 60 * 1000); // 12 hours
