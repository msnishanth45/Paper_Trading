const express = require("express");
const { getFeedStatus } = require("../controllers/feedController");

const router = express.Router();

router.get("/feed-status", getFeedStatus);

module.exports = router;
