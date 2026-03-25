const logger = require("./logger");
const socketService = require("../services/socketService");

/**
 * Safely emit Socket.IO events to connected clients.
 * This acts as a protective wrapper so that startup routines 
 * (like priceEngine) do NOT crash the server if they attempt
 * to emit events before the HTTP server and Socket.IO have
 * finished explicitly binding to their ports.
 *
 * @param {string} event - the socket event string (e.g. 'price-update')
 * @param {any} payload - payload to broadcast
 */
function emit(event, payload) {
  const io = socketService.getIO();
  if (!io) {
    logger.warn(`[SOCKET] Warning: Dropped emit('${event}') because Socket.IO is not yet initialized.`);
    return false;
  }

  try {
    io.emit(event, payload);
    return true;
  } catch (err) {
    logger.error(`[SOCKET] Failed to emit '${event}':`, err.message);
    return false;
  }
}

module.exports = { emit };
