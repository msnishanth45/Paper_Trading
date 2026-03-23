const express = require("express");
const { createLimitOrder, getLimitOrders } = require("../controllers/limitOrderController");

const router = express.Router();

router.post("/limit-order", createLimitOrder);
router.get("/limit-orders/:userId", getLimitOrders);

module.exports = router;
