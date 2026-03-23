const supabase = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");

/**
 * POST /api/create-user
 * Creates a new user with 100,000 starting balance.
 */
const createUser = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .insert([{ balance: 100000 }])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ success: false, message: "Failed to create user" });
  }

  res.json({ success: true, data });
});

/**
 * GET /api/user/:id
 * Returns user profile with balance.
 */
const getUser = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.json({ success: true, data });
});

module.exports = { createUser, getUser };
