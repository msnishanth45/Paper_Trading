const express = require("express");
const router = express.Router();
const { buyOrder, sellOrder, optionBuyOrder, optionSellOrder, getOpenPositions, modifyOrder, cancelOrderController } = require("../controllers/orderController");
const { createLimitOrder, getLimitOrders } = require("../controllers/limitOrderController");
const { authenticate } = require("../middleware/auth");

// All order routes are protected
router.use(authenticate);

// POST /api/orders/buy
router.post("/buy", buyOrder);

// POST /api/orders/sell
router.post("/sell", sellOrder);

// POST /api/orders/option-buy
router.post("/option-buy", optionBuyOrder);

// POST /api/orders/option-sell
router.post("/option-sell", optionSellOrder);

// POST /api/orders/limit
router.post("/limit", createLimitOrder);

// GET /api/orders/open — open positions
router.get("/open", getOpenPositions);

// GET /api/orders/pending — pending limit orders
router.get("/pending", getLimitOrders);

// PATCH /api/orders/:id/modify — modify target/sl/trailing_sl
router.patch("/:id/modify", modifyOrder);

// DELETE /api/orders/:id/cancel — cancel pending order
router.delete("/:id/cancel", cancelOrderController);

module.exports = router;
