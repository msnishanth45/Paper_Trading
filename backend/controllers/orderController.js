const { executeBuy, executeSell } = require("../services/orderService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * POST /api/buy
 * Body: { user_id, symbol, qty, target?, stoploss? }
 */
const buyOrder = asyncHandler(async (req, res) => {
  const { user_id, symbol, qty, target, stoploss } = req.body;

  if (!user_id || !symbol || !qty) {
    return res.status(400).json({ success: false, message: "user_id, symbol, and qty are required" });
  }

  const result = await executeBuy(user_id, symbol.toUpperCase(), qty, target, stoploss);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

/**
 * POST /api/sell
 * Body: { user_id, position_id }
 */
const sellOrder = asyncHandler(async (req, res) => {
  const { user_id, position_id } = req.body;

  if (!user_id || !position_id) {
    return res.status(400).json({ success: false, message: "user_id and position_id are required" });
  }

  const result = await executeSell(user_id, position_id);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

const supabase = require("../config/supabase");

const getOpenPositions = async (req, res) => {

  try {

    const { userId } = req.params;

    const { data, error } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "OPEN");

    if (error) {
      return res.json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      positions: data
    });

  } catch (err) {

    res.json({
      success: false,
      message: "Server error"
    });

  }

};

module.exports.getOpenPositions = getOpenPositions;

module.exports = { buyOrder, sellOrder, getOpenPositions};
