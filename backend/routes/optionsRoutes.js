const express = require("express");
const router = express.Router();
const { getOptionChain, getExpiries } = require("../controllers/optionsController");
const { authenticate } = require("../middleware/auth");

// All options routes will be protected
router.use(authenticate);

// GET /api/options/chain?symbol=NIFTY&expiry=YYYY-MM-DD
router.get("/chain", getOptionChain);

// GET /api/options/expiries?symbol=NIFTY
router.get("/expiries", getExpiries);

module.exports = router;
