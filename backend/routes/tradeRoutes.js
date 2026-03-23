const express = require("express");
const { getTradeHistory } = require("../controllers/tradeHistoryController");

const router = express.Router();

router.get("/trade-history/:userId", getTradeHistory);

module.exports = router;
