const express = require("express");
const router = express.Router();
const { getUser, getWallet } = require("../controllers/userController");
const { authenticate } = require("../middleware/auth");

// All user routes are protected
router.use(authenticate);

// GET /api/user/profile
router.get("/profile", getUser);

// GET /api/user/wallet
router.get("/wallet", getWallet);

module.exports = router;
