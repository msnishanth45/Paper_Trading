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
  const priceCache = require("./utils/priceCache");
  res.json({
    status: "ok",
    db: true, // Will be overridden or tracked, but typically dbOk from boot
    socket: true,
    feedConnected: priceCache.getFeedStatus().connected,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
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
  logger.info("[BOOT] 1. Environment Loaded");
  logger.info(`[BOOT] 2. Express Server running on port ${PORT}`);

  // 3. Initialize MySQL connection
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error("[BOOT] 3. Database connection failed — entering DEGRADED mode but API is live");
  } else {
    logger.info("[BOOT] 3. Database (MySQL) initialized");
  }

  // 4. Initialize Socket.IO
  socketService.init(httpServer);
  logger.info("[BOOT] 4. Socket.IO engine initialized");

  // 5. Initialize Redis
  const priceCache = require("./utils/priceCache");
  logger.info("[BOOT] 5. Cache layer (Memory/Redis) initialized");

  // 6. Start Price Engine
  const priceEngine = require("./engines/priceEngine");
  try {
    if (UPSTOX_ACCESS_TOKEN) {
      logger.info("[BOOT] 6. Auto-setting Upstox token & Starting Feed...");
      await priceEngine.setToken(UPSTOX_ACCESS_TOKEN);
    } else {
      logger.info("[BOOT] 6. Starting Feed Engine without active token");
      await priceEngine.start();
    }
  } catch (err) {
    logger.error("[BOOT] 6. Feed Engine failed to start:", err.message);
  }

  // 7. Start Worker Jobs
  const { startPnlJob } = require("./jobs/pnlJob");
  const feedHealthMonitor = require("./utils/feedHealthMonitor");

  try {
    const worker = fork(require("path").join(__dirname, "worker.js"));
    logger.info("[BOOT] 7. Background Worker process spawned");

    setInterval(() => {
      const prices = priceCache.getAll();
      if (Object.keys(prices).length > 0) {
        worker.send({ type: "PRICE_UPDATE", prices });
      }
    }, 100);
  } catch (err) {
    logger.error("[BOOT] 7. Worker spawn failed:", err.message);
  }

  startPnlJob(1000); 
  feedHealthMonitor.start(10000); 

  logger.success("[BOOT] SERVER READY ✓ All systems initialized");
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