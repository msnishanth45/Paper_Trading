const express = require("express");
const router = express.Router();
const { buyOrder, sellOrder, getOpenPositions, modifyOrder } = require("../controllers/orderController");
const { createLimitOrder, getLimitOrders } = require("../controllers/limitOrderController");
const { authenticate } = require("../middleware/auth");

// All order routes are protected
router.use(authenticate);

// POST /api/orders/buy
router.post("/buy", buyOrder);

// POST /api/orders/sell
router.post("/sell", sellOrder);

// POST /api/orders/limit
router.post("/limit", createLimitOrder);

// GET /api/orders/open — open positions
router.get("/open", getOpenPositions);

// GET /api/orders/pending — pending limit orders
router.get("/pending", getLimitOrders);

// PATCH /api/orders/:id — modify target/sl of a position
router.patch("/:id", modifyOrder);

module.exports = router;
