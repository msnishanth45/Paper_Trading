const { query } = require("../db/mysql");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const logger = require("../utils/logger");
const socketService = require("./socketService");

/**
 * Execute a BUY market order.
 */
async function executeBuy(userId, symbol, qty, target = null, stoploss = null, instrument_key = null, option_type = null, strike = null, expiry = null) {
  // 1. Market check
  if (!isMarketOpen()) {
    return { success: false, message: "Market is closed" };
  }

  // 2. Price check
  const price = priceCache.get(symbol);
  if (!price) {
    return { success: false, message: `Price not available for ${symbol}` };
  }

  // 3. Fetch wallet
  const wallets = await query("SELECT balance FROM wallets WHERE user_id = ?", [
    userId,
  ]);

  if (wallets.length === 0) {
    return { success: false, message: "User wallet not found" };
  }

  const balance = parseFloat(wallets[0].balance);

  // 4. Balance check
  const cost = price * qty;
  if (balance < cost) {
    return { success: false, message: "Insufficient balance" };
  }

  // 5. Deduct balance
  await query("UPDATE wallets SET balance = balance - ? WHERE user_id = ?", [
    cost,
    userId,
  ]);

  // 6. Insert position
  try {
    const result = await query(
      `INSERT INTO positions (user_id, symbol, qty, avg_price, target, stoploss, status, instrument_key, option_type, strike, expiry)
       VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)`,
      [userId, symbol, qty, price, target || null, stoploss || null, instrument_key || null, option_type || null, strike || null, expiry || null]
    );

    const positionId = result.insertId;

    // 7. Record transaction
    await query(
      "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'BUY', ?, ?)",
      [userId, cost, `BUY ${symbol} x${qty} @ ${price}`]
    );

    logger.trade(`BUY ${symbol} x${qty} @ ${price} for user ${userId}`);

    // Emit order update via Socket.IO
    socketService.emitOrderUpdate(userId, {
      type: "BUY",
      symbol,
      qty,
      price,
      positionId,
    });

    return {
      success: true,
      message: "BUY executed",
      data: {
        position: {
          id: positionId,
          user_id: userId,
          symbol,
          qty,
          avg_price: price,
          target,
          stoploss,
          status: "OPEN",
          instrument_key,
          option_type,
          strike,
          expiry
        },
        entryPrice: price,
        cost,
      },
    };
  } catch (err) {
    // Rollback balance
    await query("UPDATE wallets SET balance = balance + ? WHERE user_id = ?", [
      cost,
      userId,
    ]);
    logger.error("Position insert failed:", err.message);
    return { success: false, message: "Failed to create position" };
  }
}

/**
 * Execute a SELL — close an existing open position.
 */
async function executeSell(userId, positionId) {
  // 1. Market check
  if (!isMarketOpen()) {
    return { success: false, message: "Market is closed" };
  }

  // 2. Fetch position
  const positions = await query(
    "SELECT * FROM positions WHERE id = ? AND user_id = ? AND status = 'OPEN'",
    [positionId, userId]
  );

  if (positions.length === 0) {
    return { success: false, message: "Open position not found" };
  }

  const position = positions[0];

  // 3. Price check
  const exitPrice = priceCache.get(position.symbol);
  if (!exitPrice) {
    return {
      success: false,
      message: `Price not available for ${position.symbol}`,
    };
  }

  // 4. Calculate PnL
  const pnl = (exitPrice - parseFloat(position.avg_price)) * position.qty;
  const proceeds = exitPrice * position.qty;

  // 5. Close position
  await query("UPDATE positions SET status = 'CLOSED' WHERE id = ?", [
    positionId,
  ]);

  // 6. Update balance
  await query("UPDATE wallets SET balance = balance + ? WHERE user_id = ?", [
    proceeds,
    userId,
  ]);

  // 7. Insert trade record
  await query(
    `INSERT INTO trades (user_id, symbol, qty, entry_price, exit_price, pnl, side, exit_reason, instrument_key, option_type, strike, expiry)
     VALUES (?, ?, ?, ?, ?, ?, 'BUY', 'MANUAL', ?, ?, ?, ?)`,
    [
      userId,
      position.symbol,
      position.qty,
      position.avg_price,
      exitPrice,
      pnl,
      position.instrument_key,
      position.option_type,
      position.strike,
      position.expiry
    ]
  );

  // 8. Record transaction
  await query(
    "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'SELL', ?, ?)",
    [
      userId,
      proceeds,
      `SELL ${position.symbol} x${position.qty} @ ${exitPrice} | PnL: ${pnl.toFixed(2)}`,
    ]
  );

  logger.trade(
    `SELL ${position.symbol} x${position.qty} @ ${exitPrice} | PnL: ${pnl.toFixed(2)} for user ${userId}`
  );

  // Emit order update via Socket.IO
  socketService.emitOrderUpdate(userId, {
    type: "SELL",
    symbol: position.symbol,
    qty: position.qty,
    exitPrice,
    pnl,
    positionId,
  });

  return {
    success: true,
    message: "SELL executed",
    data: { exitPrice, pnl: parseFloat(pnl.toFixed(2)), proceeds },
  };
}

module.exports = { executeBuy, executeSell };
