const express = require("express");
const { buyOrder, sellOrder } = require("../controllers/orderController");

const router = express.Router();

router.post("/buy", buyOrder);
router.post("/sell", sellOrder);

module.exports = router;
