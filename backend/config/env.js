require("dotenv").config();

const required = ["SUPABASE_URL", "SUPABASE_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  PORT: parseInt(process.env.PORT, 10) || 5000,
  SL_TARGET_INTERVAL: parseInt(process.env.SL_TARGET_INTERVAL, 10) || 1500,
  LIMIT_ORDER_INTERVAL: parseInt(process.env.LIMIT_ORDER_INTERVAL, 10) || 2000,
};
