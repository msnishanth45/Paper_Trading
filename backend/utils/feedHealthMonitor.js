const priceCache = require("./priceCache");
const logger = require("./logger");
const socketService = require("../services/socketService");

class FeedHealthMonitor {
  constructor() {
    this.intervalId = null;
    this.lastTickCount = 0;
    this.staleThresholdMs = 30000; // 30 seconds
  }

  start(intervalMs = 10000) {
    if (this.intervalId) return;

    logger.info(`[HEALTH] Feed monitor started (interval: ${intervalMs}ms)`);

    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("[HEALTH] Feed monitor stopped");
    }
  }

  checkHealth() {
    const status = priceCache.getFeedStatus();
    
    // Check 1: Is WS connected?
    if (!status.connected) {
      logger.warn("[HEALTH] Feed is currently DISCONNECTED");
      return;
    }

    // Check 2: Are we receiving ticks?
    const currentTicks = status.totalTicks;
    const ticksInWindow = currentTicks - this.lastTickCount;
    this.lastTickCount = currentTicks;

    if (ticksInWindow === 0 && status.symbolCount > 0) {
      // Possible stale feed or quiet market
      const lastAnyTick = priceCache.getLastTickTimeAny();
      if (lastAnyTick) {
        const timeSinceTick = Date.now() - lastAnyTick;
        if (timeSinceTick > this.staleThresholdMs) {
          logger.error(`[HEALTH] Feed STALE. No ticks for ${(timeSinceTick/1000).toFixed(1)}s across ${status.symbolCount} symbols.`);
        } else {
          logger.warn(`[HEALTH] Low activity: 0 ticks in last interval, but last tick was ${(timeSinceTick/1000).toFixed(1)}s ago.`);
        }
      }
    } else if (ticksInWindow > 0) {
      // Feed is healthy
      logger.debug(`[HEALTH] Healthy: processed ${ticksInWindow} ticks across ${status.symbolCount} instruments.`);
    }

    // Push health event to connected admins (or broadcast)
    socketService.io.emit("feed_health", {
      status: ticksInWindow > 0 ? "healthy" : "warning",
      ticksInWindow,
      totalTicks: status.totalTicks,
      symbolCount: status.symbolCount,
      timestamp: Date.now()
    });
  }
}

module.exports = new FeedHealthMonitor();
