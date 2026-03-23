const express = require("express");
const { setToken } = require("../controllers/tokenController");

const router = express.Router();

router.post("/set-token", setToken);

module.exports = router;
