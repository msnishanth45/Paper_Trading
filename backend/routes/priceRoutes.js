const express = require("express");
const { getPrice, getAllPrices } = require("../controllers/priceController");

const router = express.Router();

/* ⭐ TEMP PRICE INJECTION (SIMULATION) */

const priceCache = require("../utils/priceCache");

router.post("/set-price", (req, res) => {

  const { symbol, price } = req.body;

  if (!symbol || !price) {
    return res.json({
      success: false,
      message: "symbol & price required"
    });
  }

  priceCache.set(symbol, Number(price));

  res.json({
    success: true,
    message: "Price Injected",
    price: priceCache.get(symbol)
  });

});

router.get("/price/:symbol", getPrice);
router.get("/prices", getAllPrices);

module.exports = router;
