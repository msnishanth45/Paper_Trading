const express = require("express");
const { buyOrder, sellOrder, getOpenPositions } = require("../controllers/orderController");
const router = express.Router();

router.post("/buy", buyOrder);
router.post("/sell", sellOrder);
router.get("/positions/:userId", getOpenPositions);

module.exports = router;
