const { query } = require("../db/mysql");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const logger = require("../utils/logger");
const socketService = require("./socketService");

/**
 * Execute a BUY market order.
 */
async function executeBuy(userId, symbol, qty, target = null, stoploss = null, instrument_key = null, option_type = null, strike = null, expiry = null, trailing_sl = null) {
  if (!isMarketOpen()) {
    return { success: false, message: "Market is closed" };
  }

  // Price safety guard
  const price = priceCache.get(symbol);
  if (!price || price <= 0) {
    return { success: false, message: `Price not available for ${symbol}. Cannot execute with null price.` };
  }

  // Input validation
  if (!qty || qty <= 0) {
    return { success: false, message: "Quantity must be greater than 0" };
  }

  // Fetch wallet
  const wallets = await query("SELECT balance FROM wallets WHERE user_id = ?", [userId]);
  if (wallets.length === 0) {
    return { success: false, message: "User wallet not found" };
  }

  const balance = parseFloat(wallets[0].balance);
  const cost = price * qty;
  if (balance < cost) {
    return { success: false, message: "Insufficient balance" };
  }

  // Deduct balance
  await query("UPDATE wallets SET balance = balance - ? WHERE user_id = ?", [cost, userId]);

  try {
    const result = await query(
      `INSERT INTO positions (user_id, symbol, qty, avg_price, peak_price, target, stoploss, trailing_sl, status, side, instrument_key, option_type, strike, expiry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 'BUY', ?, ?, ?, ?)`,
      [userId, symbol, qty, price, price, target || null, stoploss || null, trailing_sl || null, instrument_key || null, option_type || null, strike || null, expiry || null]
    );

    const positionId = result.insertId;

    // Record transaction
    await query(
      "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'BUY', ?, ?)",
      [userId, cost, `BUY ${symbol} x${qty} @ ${price}`]
    );

    logger.trade(`BUY ${symbol} x${qty} @ ${price} for user ${userId}`);

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
          trailing_sl,
          status: "OPEN",
          side: "BUY",
          instrument_key,
          option_type,
          strike,
          expiry,
        },
        entryPrice: price,
        cost,
      },
    };
  } catch (err) {
    // Rollback balance
    await query("UPDATE wallets SET balance = balance + ? WHERE user_id = ?", [cost, userId]);
    logger.error("Position insert failed:", err.message);
    return { success: false, message: "Failed to create position" };
  }
}

/**
 * Execute a SELL — close an existing open position (full or partial).
 */
async function executeSell(userId, positionId, exitQty = null) {
  if (!isMarketOpen()) {
    return { success: false, message: "Market is closed" };
  }

  const positions = await query(
    "SELECT * FROM positions WHERE id = ? AND user_id = ? AND status = 'OPEN'",
    [positionId, userId]
  );

  if (positions.length === 0) {
    return { success: false, message: "Open position not found" };
  }

  const position = positions[0];

  // Price safety guard
  const exitPrice = priceCache.get(position.symbol);
  if (!exitPrice || exitPrice <= 0) {
    return {
      success: false,
      message: `Price not available for ${position.symbol}. Cannot exit with null price.`,
    };
  }

  // Determine exit quantity (partial or full)
  const sellQty = exitQty && exitQty > 0 && exitQty < position.qty ? exitQty : position.qty;
  const isPartialExit = sellQty < position.qty;

  // Calculate PnL
  const avgPrice = parseFloat(position.avg_price);
  const pnl = (exitPrice - avgPrice) * sellQty;
  const proceeds = exitPrice * sellQty;

  if (isPartialExit) {
    // Partial exit — reduce qty on existing position
    await query("UPDATE positions SET qty = qty - ? WHERE id = ?", [sellQty, positionId]);
  } else {
    // Full exit — close position
    await query("UPDATE positions SET status = 'CLOSED' WHERE id = ?", [positionId]);
  }

  // Update balance
  await query("UPDATE wallets SET balance = balance + ? WHERE user_id = ?", [proceeds, userId]);

  // Insert trade record
  await query(
    `INSERT INTO trades (user_id, symbol, qty, entry_price, exit_price, pnl, side, exit_reason, instrument_key, option_type, strike, expiry)
     VALUES (?, ?, ?, ?, ?, ?, 'BUY', 'MANUAL', ?, ?, ?, ?)`,
    [
      userId,
      position.symbol,
      sellQty,
      avgPrice,
      exitPrice,
      pnl,
      position.instrument_key,
      position.option_type,
      position.strike,
      position.expiry,
    ]
  );

  // Record transaction
  await query(
    "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'SELL', ?, ?)",
    [
      userId,
      proceeds,
      `SELL ${position.symbol} x${sellQty} @ ${exitPrice} | PnL: ${pnl.toFixed(2)}${isPartialExit ? ' (PARTIAL)' : ''}`,
    ]
  );

  logger.trade(
    `SELL ${position.symbol} x${sellQty} @ ${exitPrice} | PnL: ${pnl.toFixed(2)}${isPartialExit ? ' (PARTIAL)' : ''} for user ${userId}`
  );

  socketService.emitOrderUpdate(userId, {
    type: isPartialExit ? "PARTIAL_SELL" : "SELL",
    symbol: position.symbol,
    qty: sellQty,
    exitPrice,
    pnl,
    positionId,
  });

  return {
    success: true,
    message: isPartialExit ? "Partial exit executed" : "SELL executed",
    data: { exitPrice, pnl: parseFloat(pnl.toFixed(2)), proceeds, partialExit: isPartialExit },
  };
}

/**
 * Execute an Option BUY order.
 * Requires: symbol (trading symbol), qty, instrument_key, option_type, strike, expiry
 */
async function executeOptionBuy(userId, { symbol, qty, target, stoploss, trailing_sl, instrument_key, option_type, strike, expiry, order_type = "MARKET", limit_price }) {
  // Validation
  if (!symbol || !qty || !instrument_key || !option_type || !strike || !expiry) {
    return { success: false, message: "symbol, qty, instrument_key, option_type, strike, and expiry are required" };
  }

  if (!["CE", "PE"].includes(option_type)) {
    return { success: false, message: "option_type must be CE or PE" };
  }

  if (qty <= 0) {
    return { success: false, message: "Quantity must be greater than 0" };
  }

  if (order_type === "LIMIT" && limit_price) {
    // For limit orders, delegate to limit order service
    const { placeLimitOrder } = require("./limitOrderService");
    return placeLimitOrder(userId, symbol, qty, limit_price, "BUY", target, stoploss, instrument_key, option_type, strike, expiry);
  }

  // Market order — execute immediately
  return executeBuy(userId, symbol, qty, target, stoploss, instrument_key, option_type, strike, expiry, trailing_sl);
}

/**
 * Execute an Option SELL order.
 * Can be full or partial exit.
 */
async function executeOptionSell(userId, { position_id, qty, exit_type = "FULL" }) {
  if (!position_id) {
    return { success: false, message: "position_id is required" };
  }

  const exitQty = exit_type === "PARTIAL" && qty ? qty : null;
  return executeSell(userId, position_id, exitQty);
}

/**
 * Cancel a pending order.
 */
async function cancelOrder(userId, orderId) {
  const orders = await query(
    "SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = 'PENDING'",
    [orderId, userId]
  );

  if (orders.length === 0) {
    return { success: false, message: "Pending order not found" };
  }

  await query("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", [orderId]);

  logger.trade(`Order ${orderId} cancelled by user ${userId}`);

  socketService.emitOrderUpdate(userId, {
    type: "CANCEL",
    orderId,
  });

  return {
    success: true,
    message: "Order cancelled",
    data: { orderId, status: "CANCELLED" },
  };
}

module.exports = { executeBuy, executeSell, executeOptionBuy, executeOptionSell, cancelOrder };
