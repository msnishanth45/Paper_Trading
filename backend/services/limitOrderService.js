const supabase = require("../config/supabase");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const { executeBuy } = require("./orderService");
const logger = require("../utils/logger");

/**
 * Place a new limit order (stored as PENDING in DB).
 */
async function placeLimitOrder(userId, symbol, qty, limitPrice, side = "BUY", target = null, stoploss = null) {
  if (!isMarketOpen()) {
    return { success: false, message: "Market is closed" };
  }

  // Validate user exists
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, balance")
    .eq("id", userId)
    .single();

  if (userErr || !user) {
    return { success: false, message: "User not found" };
  }

  // For BUY limit orders, check if user has enough balance
  if (side === "BUY") {
    const cost = limitPrice * qty;
    if (user.balance < cost) {
      return { success: false, message: "Insufficient balance for limit order" };
    }
  }

  const { data: order, error: orderErr } = await supabase
    .from("pending_orders")
    .insert([
      {
        user_id: userId,
        symbol,
        qty,
        limit_price: limitPrice,
        side,
        target: target || null,
        stoploss: stoploss || null,
        status: "PENDING",
      },
    ])
    .select()
    .single();

  if (orderErr) {
    logger.error("Limit order insert failed:", orderErr.message);
    return { success: false, message: "Failed to place limit order" };
  }

  logger.trade(`LIMIT ${side} ${symbol} x${qty} @ ${limitPrice} placed for user ${userId}`);

  return {
    success: true,
    message: "Limit order placed",
    data: order,
  };
}

/**
 * Background job: match pending limit orders against current LTP.
 */
async function matchPendingOrders() {
  if (!isMarketOpen()) return;

  const { data: orders, error } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("status", "PENDING");

  if (error || !orders || orders.length === 0) return;

  for (const order of orders) {
    const ltp = priceCache.get(order.symbol);
    if (!ltp) continue;

    let shouldExecute = false;

    if (order.side === "BUY" && ltp <= order.limit_price) {
      shouldExecute = true;
    } else if (order.side === "SELL" && ltp >= order.limit_price) {
      shouldExecute = true;
    }

    if (!shouldExecute) continue;

    logger.trade(`LIMIT ORDER TRIGGERED: ${order.side} ${order.symbol} x${order.qty} @ LTP ${ltp}`);

    if (order.side === "BUY") {
      const result = await executeBuy(
        order.user_id,
        order.symbol,
        order.qty,
        order.target,
        order.stoploss
      );

      if (result.success) {
        await supabase
          .from("pending_orders")
          .update({ status: "EXECUTED" })
          .eq("id", order.id);
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
  const { data, error } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, message: "Failed to fetch orders" };
  }

  return { success: true, data };
}

module.exports = { placeLimitOrder, matchPendingOrders, getUserPendingOrders };
