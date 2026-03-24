const express = require("express");
const router = express.Router();
const { getPrice, getAllPrices } = require("../controllers/priceController");
const { getFeedStatus } = require("../controllers/feedController");
const { setToken } = require("../controllers/tokenController");
const { getMarketStatus } = require("../controllers/marketController");

// GET /api/market/status — check if market is open
router.get("/status", getMarketStatus);

// GET /api/market/prices — all cached prices
router.get("/prices", getAllPrices);

// GET /api/market/price/:symbol — single symbol price
router.get("/price/:symbol", getPrice);

// GET /api/market/feed-status — WebSocket feed status
router.get("/feed-status", getFeedStatus);

// POST /api/market/set-token — update Upstox access token
router.post("/set-token", setToken);

module.exports = router;
