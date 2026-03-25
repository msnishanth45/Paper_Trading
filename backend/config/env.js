require("dotenv").config();

const required = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE", "JWT_SECRET"];

function validateEnv(requiredKeys) {
  for (const key of requiredKeys) {
    if (!process.env[key]) {
      console.warn(`[ENV] ⚠️ Missing recommended env var: ${key} — Running in DEGRADED mode`);
    }
  }
}

validateEnv(required);

module.exports = {
  // MySQL
  MYSQL_HOST: process.env.MYSQL_HOST,
  MYSQL_PORT: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  MYSQL_USER: process.env.MYSQL_USER,
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // Server
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // Upstox
  UPSTOX_API_KEY: process.env.UPSTOX_API_KEY || "",
  UPSTOX_API_SECRET: process.env.UPSTOX_API_SECRET || "",
  UPSTOX_ACCESS_TOKEN: process.env.UPSTOX_ACCESS_TOKEN || "",

  // Redis (optional)
  REDIS_URL: process.env.REDIS_URL || "",

  // Feed config
  HEARTBEAT_TIMEOUT_MS: parseInt(process.env.HEARTBEAT_TIMEOUT_MS, 10) || 10000,

  // Job intervals (ms)
  SL_TARGET_INTERVAL: parseInt(process.env.SL_TARGET_INTERVAL, 10) || 1500,
  LIMIT_ORDER_INTERVAL: parseInt(process.env.LIMIT_ORDER_INTERVAL, 10) || 2000,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};
