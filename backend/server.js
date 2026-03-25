/* ═══════════════════════════════════════════════════
   Paper Trading Backend — Entry Point (v3.0)
   
   Production-grade server with:
   • JWT Authentication
   • MySQL Database
   • Socket.IO real-time push
   • Dynamic instrument resolution
   • Auto-start market feed from env token
   • Structured logging & error handling
   ═══════════════════════════════════════════════════ */

const http = require("http");
const {
  PORT,
  SL_TARGET_INTERVAL,
  LIMIT_ORDER_INTERVAL,
  UPSTOX_ACCESS_TOKEN,
} = require("./config/env");
const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");
const socketService = require("./services/socketService");
const { testConnection } = require("./db/mysql");
const { fork } = require("child_process");

/* ── Express App ── */

const app = express();
app.use(cors());
app.use(express.json());

/* ── Request Logger Middleware ── */

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path !== "/health" && req.path !== "/") {
      logger.debug(
        `${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`
      );
    }
  });
  next();
});

/* ── Routes ── */

// Auth (public)
app.use("/api/auth", require("./routes/authRoutes"));

// Market (public — prices and feed status)
app.use("/api/market", require("./routes/marketRoutes"));

// Orders (protected)
app.use("/api/orders", require("./routes/orderRoutes"));

// Portfolio (protected)
app.use("/api/portfolio", require("./routes/portfolioRoutes"));

// Options (protected)
app.use("/api/options", require("./routes/optionsRoutes"));

// User (protected)
app.use("/api/user", require("./routes/userRoutes"));

// Trades (protected)
app.use("/api/trades", require("./routes/tradeRoutes"));

// System APIs (protected)
app.use("/api/system", require("./routes/systemRoutes"));

/* ── Health Check ── */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Paper Trading Backend",
    version: "3.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    status: "running",
    service: "Paper Trading Backend",
    version: "3.0.0",
    features: [
      "JWT Authentication",
      "MySQL Database",
      "Dynamic Instrument Resolution",
      "Upstox WS v3 Full Feed",
      "Heartbeat Timeout Detection",
      "Socket.IO Real-time Push",
      "Optional Redis Cache",
      "Structured Logging",
    ],
    endpoints: {
      auth: "POST /api/auth/register, POST /api/auth/login, GET /api/auth/profile",
      orders:
        "POST /api/orders/buy, POST /api/orders/sell, POST /api/orders/limit",
      portfolio:
        "GET /api/portfolio/positions, GET /api/portfolio/pnl, GET /api/portfolio/history",
      options:
        "GET /api/options/chain?symbol=NIFTY",
      market:
        "GET /api/market/prices, GET /api/market/feed-status, GET /api/market/price/:symbol",
      user: "GET /api/user/profile, GET /api/user/wallet",
      health: "GET /health",
    },
  });
});

/* ── 404 Handler ── */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

/* ── Global Error Handler ── */

app.use((err, req, res, _next) => {
  logger.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

/* ── Create HTTP Server (for Socket.IO) ── */

const httpServer = http.createServer(app);

/* ── Start Server ── */

httpServer.listen(PORT, async () => {
  logger.success(`Server running on port ${PORT}`);

  // 1. Test MySQL connection
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error("[SERVER] MySQL connection failed — some features will not work");
  }

  // 2. Initialize Socket.IO
  socketService.init(httpServer);

  // 3. Start price engine
  const priceEngine = require("./engines/priceEngine");

  // Auto-set token from env if available
  if (UPSTOX_ACCESS_TOKEN) {
    logger.success("[SERVER] Auto-setting Upstox token from env");
    await priceEngine.setToken(UPSTOX_ACCESS_TOKEN);
  } else {
    await priceEngine.start();
  }

  const { startPnlJob } = require("./jobs/pnlJob");
  const feedHealthMonitor = require("./utils/feedHealthMonitor");

  // Phase 8: Spawn Background Worker Process
  const worker = fork(require("path").join(__dirname, "worker.js"));
  logger.success("[SERVER] Background worker process spawned");

  // Push prices to worker via IPC (since it runs on a separate Node isolate)
  const priceCache = require("./utils/priceCache");
  setInterval(() => {
    const prices = priceCache.getAll();
    if (Object.keys(prices).length > 0) {
      worker.send({ type: "PRICE_UPDATE", prices });
    }
  }, 100);

  startPnlJob(1000); // 1-second interval for PnL UI feedback
  feedHealthMonitor.start(10000); // Check every 10s

  logger.success("All systems initialized ✓");
});

/* ── Graceful Shutdown ── */

function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  const priceEngine = require("./engines/priceEngine");
  const { stopPnlJob } = require("./jobs/pnlJob");
  const feedHealthMonitor = require("./utils/feedHealthMonitor");

  priceEngine.stop();
  stopPnlJob();
  feedHealthMonitor.stop();

  httpServer.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));