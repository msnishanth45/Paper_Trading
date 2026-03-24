const express = require("express");
const router = express.Router();
const { register, login, getProfile, testAuth } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

// GET /api/auth/test
router.get("/test", authenticate, testAuth);

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/profile (protected)
router.get("/profile", authenticate, getProfile);

module.exports = router;
