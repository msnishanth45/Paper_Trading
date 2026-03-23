/* ═══════════════════════════════════════════════════
   Paper Trading Backend — Entry Point
   ═══════════════════════════════════════════════════ */

const { PORT, SL_TARGET_INTERVAL, LIMIT_ORDER_INTERVAL } = require("./config/env");
const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");

const priceCache = require("./utils/priceCache");   // ⭐ IMPORTANT

/* ── Express App ── */

const app = express();
app.use(cors());
app.use(express.json());

/* ⭐ TEMP PRICE INJECTION API (SIMULATION MODE ONLY) */

app.post("/api/set-price", (req, res) => {

  const { symbol, price } = req.body;

  if (!symbol || !price) {
    return res.json({
      success: false,
      message: "symbol & price required"
    });
  }

  priceCache.set(symbol, Number(price));   // ⭐ CORRECT ENGINE INJECTION

  res.json({
    success: true,
    message: "Price Injected Successfully",
    price: priceCache.get(symbol)
  });

});

/* ── Routes ── */

app.use("/api", require("./routes/tokenRoutes"));
app.use("/api", require("./routes/priceRoutes"));
app.use("/api", require("./routes/marketRoutes"));
app.use("/api", require("./routes/orderRoutes"));
app.use("/api", require("./routes/limitOrderRoutes"));
app.use("/api", require("./routes/portfolioRoutes"));
app.use("/api", require("./routes/tradeRoutes"));
app.use("/api", require("./routes/userRoutes"));

/* ── Health Check ── */

app.get("/", (req, res) => {
  res.json({
    status: "running",
    service: "Paper Trading Backend",
    version: "2.0.0",
  });
});

/* ── Global Error Handler ── */

app.use((err, req, res, _next) => {
  logger.error("Unhandled error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

/* ── Start Server ── */

const server = app.listen(PORT, async () => {

  logger.success(`Server running on port ${PORT}`);

  const priceEngine = require("./engines/priceEngine");
  await priceEngine.start();

  const { startSlTargetJob } = require("./jobs/slTargetJob");
  const { startLimitOrderJob } = require("./jobs/limitOrderJob");

  startSlTargetJob(SL_TARGET_INTERVAL);
  startLimitOrderJob(LIMIT_ORDER_INTERVAL);

  logger.success("All systems initialized");

});

/* ── Graceful Shutdown ── */

function shutdown(signal) {

  logger.info(`${signal} received — shutting down gracefully`);

  const priceEngine = require("./engines/priceEngine");
  const { stopSlTargetJob } = require("./jobs/slTargetJob");
  const { stopLimitOrderJob } = require("./jobs/limitOrderJob");

  priceEngine.stop();
  stopSlTargetJob();
  stopLimitOrderJob();

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });

}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));