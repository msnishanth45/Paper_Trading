const express = require("express");
const router = express.Router();
const { getPositions, getPnL, getHistory } = require("../controllers/portfolioController");
const { authenticate } = require("../middleware/auth");

// All portfolio routes are protected
router.use(authenticate);

// GET /api/portfolio/positions
router.get("/positions", getPositions);

// GET /api/portfolio/pnl
router.get("/pnl", getPnL);

// GET /api/portfolio/history
router.get("/history", getHistory);

module.exports = router;
