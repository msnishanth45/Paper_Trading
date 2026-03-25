const { query } = require("../db/mysql");
const priceEngine = require("../engines/priceEngine");
const executionQueue = require("../services/executionQueue");
const socketService = require("../services/socketService");

/**
 * GET /api/system/tick-latency
 * Return: avg latency, max latency, tick count last 1 min
 */
async function getTickLatency(req, res) {
  try {
    const rows = await query(`
      SELECT 
        COUNT(*) as tick_count,
        ROUND(AVG(latency_ms), 2) as avg_latency,
        MAX(latency_ms) as max_latency
      FROM tick_logs
      WHERE received_at >= NOW() - INTERVAL 1 MINUTE
    `);

    const stats = rows[0] || { tick_count: 0, avg_latency: 0, max_latency: 0 };

    res.json({
      success: true,
      data: {
        tickCountLastMin: stats.tick_count,
        avgLatencyMs: stats.avg_latency || 0,
        maxLatencyMs: stats.max_latency || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/system/feed-status
 * Return feed status, reconnect count, last tick
 */
async function getFeedStatus(req, res) {
  try {
    const status = priceEngine.getStatus();
    
    // Calculate seconds since last tick
    const lastTickTime = status.feedStatus.lastTickTimeAny;
    const lastTickSecondsAgo = lastTickTime 
      ? Math.floor((Date.now() - lastTickTime) / 1000) 
      : null;

    res.json({
      success: true,
      data: {
        status: status.feedHealth, // "LIVE", "DELAYED", "DISCONNECTED"
        lastTickSecondsAgo,
        reconnectCount: status.reconnectAttempts,
        connected: status.feedStatus.connected,
        uptime: process.uptime()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/system/metrics
 * Return high-performance system metrics
 */
async function getMetrics(req, res) {
  try {
    const activeUsers = socketService.getConnectedCount();
    const rows = await query("SELECT COUNT(*) as count FROM positions WHERE status='OPEN'");
    const executionStats = executionQueue.getMetrics();
    
    res.json({
      success: true,
      data: {
        activeUsers,
        openPositions: rows[0].count,
        avgOrderExecutionTimeMs: executionStats.avgExecutionTimeMs,
        activeQueues: executionStats.activeQueues,
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getTickLatency,
  getFeedStatus,
  getMetrics
};
