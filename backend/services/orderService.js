const supabase = require("../config/supabase");
const priceCache = require("../utils/priceCache");
const { isMarketOpen } = require("../utils/marketStatus");
const logger = require("../utils/logger");

/**
 * Execute a BUY market order.
 */
async function executeBuy(userId, symbol, qty, target = null, stoploss = null) {
  // 1. Market check
  if (!isMarketOpen()) {
    return { success: false, message: "Market is closed" };
  }

  // 2. Price check
  const price = priceCache.get(symbol);
  if (!price) {
    return { success: false, message: `Price not available for ${symbol}` };
  }

  // 3. Fetch user
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (userErr || !user) {
    return { success: false, message: "User not found" };
  }

  // 4. Balance check
  const cost = price * qty;
  if (user.balance < cost) {
    return { success: false, message: "Insufficient balance" };
  }

  // 5. Deduct balance
  const { error: balErr } = await supabase
    .from("users")
    .update({ balance: user.balance - cost })
    .eq("id", userId);

  if (balErr) {
    return { success: false, message: "Failed to update balance" };
  }

  // 6. Insert position
  const { data: position, error: posErr } = await supabase
    .from("positions")
    .insert([
      {
        user_id: userId,
        symbol,
        qty,
        avg_price: price,
        target: target || null,
        stoploss: stoploss || null,
        status: "OPEN",
      },
    ])
    .select()
    .single();

  if (posErr) {
    // Rollback balance
    await supabase
      .from("users")
      .update({ balance: user.balance })
      .eq("id", userId);
    return { success: false, message: "Failed to create position" };
  }

  logger.trade(`BUY ${symbol} x${qty} @ ${price} for user ${userId}`);

  return {
    success: true,
    message: "BUY executed",
    data: { position, entryPrice: price, cost },
  };
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
  const { data: position, error: posErr } = await supabase
    .from("positions")
    .select("*")
    .eq("id", positionId)
    .eq("user_id", userId)
    .eq("status", "OPEN")
    .single();

  if (posErr || !position) {
    return { success: false, message: "Open position not found" };
  }

  // 3. Price check
  const exitPrice = priceCache.get(position.symbol);
  if (!exitPrice) {
    return { success: false, message: `Price not available for ${position.symbol}` };
  }

  // 4. Calculate PnL
  const pnl = (exitPrice - position.avg_price) * position.qty;
  const proceeds = exitPrice * position.qty;

  // 5. Close position
  const { error: closeErr } = await supabase
    .from("positions")
    .update({ status: "CLOSED" })
    .eq("id", positionId);

  if (closeErr) {
    return { success: false, message: "Failed to close position" };
  }

  // 6. Update balance
  const { data: user } = await supabase
    .from("users")
    .select("balance")
    .eq("id", userId)
    .single();

  await supabase
    .from("users")
    .update({ balance: user.balance + proceeds })
    .eq("id", userId);

  // 7. Insert trade record
  await supabase.from("trades").insert([
    {
      user_id: userId,
      symbol: position.symbol,
      qty: position.qty,
      entry_price: position.avg_price,
      exit_price: exitPrice,
      pnl,
      side: "BUY",
    },
  ]);

  logger.trade(
    `SELL ${position.symbol} x${position.qty} @ ${exitPrice} | PnL: ${pnl.toFixed(2)} for user ${userId}`
  );

  return {
    success: true,
    message: "SELL executed",
    data: { exitPrice, pnl, proceeds },
  };
}

module.exports = { executeBuy, executeSell };
