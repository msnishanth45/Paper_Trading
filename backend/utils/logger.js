/* ═══════════════════════════════════════════════════
   Structured Logger — Production Grade
   Component tags, log levels, structured output.
   ═══════════════════════════════════════════════════ */

const { LOG_LEVEL } = require("../config/env");

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function shouldLog(level) {
  return LEVELS[level] >= currentLevel;
}

const logger = {
  debug: (...args) => {
    if (shouldLog("debug")) console.log(`[${timestamp()}] 🔍 DEBUG`, ...args);
  },
  info: (...args) => {
    if (shouldLog("info")) console.log(`[${timestamp()}] ℹ️  INFO `, ...args);
  },
  warn: (...args) => {
    if (shouldLog("warn")) console.warn(`[${timestamp()}] ⚠️  WARN `, ...args);
  },
  error: (...args) => {
    console.error(`[${timestamp()}] ❌ ERROR`, ...args);
  },
  success: (...args) => {
    if (shouldLog("info")) console.log(`[${timestamp()}] ✅ OK   `, ...args);
  },

  /* ── Domain-specific loggers ── */

  price: (...args) => {
    if (shouldLog("debug")) console.log(`[${timestamp()}] 💰 PRICE`, ...args);
  },
  trade: (...args) => {
    if (shouldLog("info")) console.log(`[${timestamp()}] 📊 TRADE`, ...args);
  },
  ws: (...args) => {
    if (shouldLog("info")) console.log(`[${timestamp()}] 🔌 WS   `, ...args);
  },
  feed: (...args) => {
    if (shouldLog("info")) console.log(`[${timestamp()}] 📡 FEED `, ...args);
  },
  socket: (...args) => {
    if (shouldLog("info")) console.log(`[${timestamp()}] 🌐 IO   `, ...args);
  },
};

module.exports = logger;
