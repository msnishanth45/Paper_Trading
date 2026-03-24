/* ═══════════════════════════════════════════════════
   Auth Controller — Register, Login, Profile
   ═══════════════════════════════════════════════════ */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db/mysql");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");

/**
 * Generate JWT token for a user.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * POST /api/auth/register
 * Body: { username, email, password }
 */
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "username, email, and password are required",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters",
    });
  }

  // Check if user exists
  const existing = await query(
    "SELECT id FROM users WHERE email = ? OR username = ?",
    [email, username]
  );

  if (existing.length > 0) {
    return res.status(409).json({
      success: false,
      message: "User with this email or username already exists",
    });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  // Insert user
  const result = await query(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    [username, email, password_hash]
  );

  const userId = result.insertId;

  // Create wallet with default balance
  await query("INSERT INTO wallets (user_id, balance) VALUES (?, 100000.00)", [
    userId,
  ]);

  const user = { id: userId, username, email };
  const token = generateToken(user);

  logger.success(`[AUTH] User registered: ${username} (id: ${userId})`);

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: { user, token },
  });
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "email and password are required",
    });
  }

  // Find user
  const users = await query("SELECT * FROM users WHERE email = ?", [email]);

  if (users.length === 0) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  const user = users[0];

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  const token = generateToken(user);

  logger.info(`[AUTH] User logged in: ${user.username}`);

  res.json({
    success: true,
    message: "Login successful",
    data: {
      user: { id: user.id, username: user.username, email: user.email },
      token,
    },
  });
});

/**
 * GET /api/auth/profile
 * Protected — requires JWT
 */
const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const users = await query(
    "SELECT id, username, email, created_at FROM users WHERE id = ?",
    [userId]
  );

  if (users.length === 0) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const wallets = await query(
    "SELECT balance FROM wallets WHERE user_id = ?",
    [userId]
  );

  const balance = wallets.length > 0 ? parseFloat(wallets[0].balance) : 0;

  res.json({
    success: true,
    data: {
      ...users[0],
      balance,
    },
  });
});

/**
 * GET /api/auth/test
 * Protected — explicitly testing JWT
 */
const testAuth = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: "Auth middleware is working successfully",
    user: req.user,
  });
});

module.exports = { register, login, getProfile, testAuth };
