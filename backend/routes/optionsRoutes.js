const express = require("express");
const router = express.Router();
const { getOptionChain } = require("../controllers/optionsController");
const { authenticate } = require("../middleware/auth");

// All options routes will be protected
router.use(authenticate);

// GET /api/options/chain?symbol=NIFTY
router.get("/chain", getOptionChain);

module.exports = router;
