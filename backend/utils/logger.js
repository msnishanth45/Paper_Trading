function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (...args) => console.log(`[${timestamp()}] ℹ️ `, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] ⚠️ `, ...args),
  error: (...args) => console.error(`[${timestamp()}] ❌ `, ...args),
  success: (...args) => console.log(`[${timestamp()}] ✅ `, ...args),
  price: (...args) => console.log(`[${timestamp()}] 💰 `, ...args),
  trade: (...args) => console.log(`[${timestamp()}] 📊 `, ...args),
};

module.exports = logger;
