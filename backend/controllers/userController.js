const { query } = require("../db/mysql");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/user/profile
 * Returns user profile with wallet balance (uses JWT user ID).
 */
const getUser = asyncHandler(async (req, res) => {
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
 * GET /api/user/wallet
 * Returns wallet details and recent transactions.
 */
const getWallet = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const wallets = await query(
    "SELECT balance, updated_at FROM wallets WHERE user_id = ?",
    [userId]
  );

  if (wallets.length === 0) {
    return res
      .status(404)
      .json({ success: false, message: "Wallet not found" });
  }

  const transactions = await query(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    [userId]
  );

  res.json({
    success: true,
    data: {
      balance: parseFloat(wallets[0].balance),
      updated_at: wallets[0].updated_at,
      recentTransactions: transactions,
    },
  });
});

module.exports = { getUser, getWallet };
