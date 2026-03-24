/* ═══════════════════════════════════════════════════
   Socket.IO Service — Real-Time Push Layer
   Pushes live prices, P&L, and order updates
   to connected frontend clients.
   ═══════════════════════════════════════════════════ */

const { Server } = require("socket.io");
const logger = require("../utils/logger");

let io = null;

/**
 * Initialize Socket.IO on the given HTTP server.
 * @param {import("http").Server} httpServer
 */
function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  io.on("connection", (socket) => {
    logger.socket(`Client connected: ${socket.id}`);

    socket.on("subscribe-prices", () => {
      socket.join("prices");
      logger.socket(`${socket.id} subscribed to prices`);
    });

    socket.on("subscribe-pnl", (userId) => {
      if (userId) {
        socket.join(`pnl:${userId}`);
        logger.socket(`${socket.id} subscribed to pnl:${userId}`);
      }
    });

    socket.on("subscribe-orders", (userId) => {
      if (userId) {
        socket.join(`orders:${userId}`);
        logger.socket(`${socket.id} subscribed to orders:${userId}`);
      }
    });

    socket.on("disconnect", (reason) => {
      logger.socket(`Client disconnected: ${socket.id} (${reason})`);
    });
  });

  logger.success("[SOCKET] Socket.IO server initialized");
  return io;
}

/**
 * Emit live price updates to all subscribed clients.
 * @param {Object} prices - { NIFTY: 22500, BANKNIFTY: 48500, ... }
 */
function emitPriceUpdate(prices) {
  if (!io) return;
  io.to("prices").emit("price-update", {
    prices,
    timestamp: Date.now(),
  });
}

/**
 * Emit P&L updates to a specific user.
 * @param {string} userId
 * @param {Object} pnlData
 */
function emitPnlUpdate(userId, pnlData) {
  if (!io) return;
  io.to(`pnl:${userId}`).emit("pnl-update", {
    ...pnlData,
    timestamp: Date.now(),
  });
}

/**
 * Emit order updates to a specific user.
 * @param {string} userId
 * @param {Object} orderData
 */
function emitOrderUpdate(userId, orderData) {
  if (!io) return;
  io.to(`orders:${userId}`).emit("order-update", {
    ...orderData,
    timestamp: Date.now(),
  });
}

/**
 * Get the number of connected clients.
 */
function getConnectedCount() {
  if (!io) return 0;
  return io.engine?.clientsCount || 0;
}

/**
 * Get the Socket.IO instance.
 */
function getIO() {
  return io;
}

module.exports = {
  init,
  emitPriceUpdate,
  emitPnlUpdate,
  emitOrderUpdate,
  getConnectedCount,
  getIO,
};
