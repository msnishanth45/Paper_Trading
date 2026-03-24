const express = require("express");
const router = express.Router();
const { getTradeDetail, getAllTrades } = require("../controllers/tradeController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

// GET /api/trades — all trades with optional filters
router.get("/", getAllTrades);

// GET /api/trades/:id — single trade detail
router.get("/:id", getTradeDetail);

module.exports = router;
