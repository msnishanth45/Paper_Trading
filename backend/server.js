/* ═══════════════════════════════════════════════════
   Paper Trading Backend — Entry Point (v3.0)
   
   Production-grade server with:
   • Socket.IO real-time push
   • Dynamic instrument resolution
   • Auto-start market feed from env token
   ═══════════════════════════════════════════════════ */

const http = require("http");
const { PORT, SL_TARGET_INTERVAL, LIMIT_ORDER_INTERVAL, UPSTOX_ACCESS_TOKEN } = require("./config/env");
const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");
const socketService = require("./services/socketService");

/* ── Express App ── */

const app = express();
app.use(cors());
app.use(express.json());

/* ── Routes ── */

app.use("/api", require("./routes/tokenRoutes"));
app.use("/api", require("./routes/priceRoutes"));
app.use("/api", require("./routes/marketRoutes"));
app.use("/api", require("./routes/orderRoutes"));
app.use("/api", require("./routes/limitOrderRoutes"));
app.use("/api", require("./routes/portfolioRoutes"));
app.use("/api", require("./routes/tradeRoutes"));
app.use("/api", require("./routes/userRoutes"));
app.use("/api", require("./routes/feedRoutes"));

/* ── Health Check ── */

app.get("/", (req, res) => {
  res.json({
    status: "running",
    service: "Paper Trading Backend",
    version: "3.0.0",
    features: [
      "Dynamic Instrument Resolution",
      "Upstox WS v3 Full Feed",
      "Heartbeat Timeout Detection",
      "Socket.IO Real-time Push",
      "Optional Redis Cache",
      "Structured Logging",
    ],
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

/* ── Create HTTP Server (for Socket.IO) ── */

const httpServer = http.createServer(app);

/* ── Start Server ── */

httpServer.listen(PORT, async () => {

  logger.success(`Server running on port ${PORT}`);

  // Initialize Socket.IO
  socketService.init(httpServer);

  // Start price engine
  const priceEngine = require("./engines/priceEngine");

  // Auto-set token from env if available
  if (UPSTOX_ACCESS_TOKEN) {
    logger.success("[SERVER] Auto-setting Upstox token from env");
    await priceEngine.setToken(UPSTOX_ACCESS_TOKEN);
  } else {
    await priceEngine.start();
  }

  // Start background jobs
  const { startSlTargetJob } = require("./jobs/slTargetJob");
  const { startLimitOrderJob } = require("./jobs/limitOrderJob");

  startSlTargetJob(SL_TARGET_INTERVAL);
  startLimitOrderJob(LIMIT_ORDER_INTERVAL);

  logger.success("All systems initialized ✓");

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

  httpServer.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });

}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));