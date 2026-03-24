/* ═══════════════════════════════════════════════════
   MySQL Connection Pool — mysql2/promise
   ═══════════════════════════════════════════════════ */

const mysql = require("mysql2/promise");
const logger = require("../utils/logger");

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE,
} = require("../config/env");

const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // Timezone IST
  timezone: "+05:30",
});

/**
 * Execute a parameterized SQL query.
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<Array>} rows
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Test the database connection on startup.
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    logger.success("[DB] MySQL connection established");
    conn.release();
    return true;
  } catch (err) {
    logger.error("[DB] MySQL connection failed:", err.message);
    return false;
  }
}

module.exports = { pool, query, testConnection };
