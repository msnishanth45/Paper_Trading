const express = require("express");
const router = express.Router();
const systemController = require("../controllers/systemController");
const { authenticate } = require("../middleware/auth");

router.get("/tick-latency", authenticate, systemController.getTickLatency);
router.get("/feed-status", authenticate, systemController.getFeedStatus);
router.get("/metrics", authenticate, systemController.getMetrics);

module.exports = router;
