const { query } = require("../db/mysql");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const { executeBuy } = require("./orderService");
const logger = require("../utils/logger");

/**
 * Place a new limit order (stored as PENDING in DB).
 */
async function placeLimitOrder(
  userId,
  symbol,
  qty,
  limitPrice,
  side = "BUY",
  target = null,
  stoploss = null,
  instrument_key = null,
  option_type = null,
  strike = null,
  expiry = null
) {
  if (!isMarketOpen()) {
    return { success: false, message: "Market is closed" };
  }

  // Validate user wallet exists
  const wallets = await query("SELECT balance FROM wallets WHERE user_id = ?", [
    userId,
  ]);

  if (wallets.length === 0) {
    return { success: false, message: "User wallet not found" };
  }

  // For BUY limit orders, check if user has enough balance
  if (side === "BUY") {
    const cost = limitPrice * qty;
    if (parseFloat(wallets[0].balance) < cost) {
      return {
        success: false,
        message: "Insufficient balance for limit order",
      };
    }
  }

  try {
    const result = await query(
      `INSERT INTO orders (user_id, symbol, qty, limit_price, side, target, stoploss, status, instrument_key, option_type, strike, expiry)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
      [userId, symbol, qty, limitPrice, side, target || null, stoploss || null, instrument_key || null, option_type || null, strike || null, expiry || null]
    );

    const orderId = result.insertId;

    logger.trade(
      `LIMIT ${side} ${symbol} x${qty} @ ${limitPrice} placed for user ${userId}`
    );

    return {
      success: true,
      message: "Limit order placed",
      data: {
        id: orderId,
        user_id: userId,
        symbol,
        qty,
        limit_price: limitPrice,
        side,
        target,
        stoploss,
        status: "PENDING",
      },
    };
  } catch (err) {
    logger.error("Limit order insert failed:", err.message);
    return { success: false, message: "Failed to place limit order" };
  }
}

/**
 * Background job: match pending limit orders against current LTP.
 */
async function matchPendingOrders() {
  if (!isMarketOpen()) return;

  const orders = await query("SELECT * FROM orders WHERE status = 'PENDING'");

  if (!orders || orders.length === 0) return;

  for (const order of orders) {
    const ltp = priceCache.get(order.symbol);
    if (!ltp) continue;

    let shouldExecute = false;

    if (order.side === "BUY" && ltp <= parseFloat(order.limit_price)) {
      shouldExecute = true;
    } else if (
      order.side === "SELL" &&
      ltp >= parseFloat(order.limit_price)
    ) {
      shouldExecute = true;
    }

    if (!shouldExecute) continue;

    logger.trade(
      `LIMIT ORDER TRIGGERED: ${order.side} ${order.symbol} x${order.qty} @ LTP ${ltp}`
    );

    if (order.side === "BUY") {
      const result = await executeBuy(
        order.user_id,
        order.symbol,
        order.qty,
        order.target ? parseFloat(order.target) : null,
        order.stoploss ? parseFloat(order.stoploss) : null,
        order.instrument_key,
        order.option_type,
        order.strike,
        order.expiry
      );

      if (result.success) {
        await query("UPDATE orders SET status = 'EXECUTED' WHERE id = ?", [
          order.id,
        ]);
        logger.success(`Limit order ${order.id} executed`);
      } else {
        logger.warn(`Limit order ${order.id} failed: ${result.message}`);
      }
    }
    // SELL limit orders would close positions — can be extended
  }
}

/**
 * Get pending orders for a user.
 */
async function getUserPendingOrders(userId) {
  try {
    const data = await query(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return { success: true, data };
  } catch (err) {
    return { success: false, message: "Failed to fetch orders" };
  }
}

module.exports = { placeLimitOrder, matchPendingOrders, getUserPendingOrders };
