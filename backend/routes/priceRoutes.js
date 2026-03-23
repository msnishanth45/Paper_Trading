const express = require("express");
const { getPrice, getAllPrices } = require("../controllers/priceController");

const router = express.Router();

router.get("/price/:symbol", getPrice);
router.get("/prices", getAllPrices);

module.exports = router;
