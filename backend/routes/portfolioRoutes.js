const express = require("express");
const { getPnL } = require("../controllers/portfolioController");

const router = express.Router();

router.get("/pnl/:userId", getPnL);

module.exports = router;
