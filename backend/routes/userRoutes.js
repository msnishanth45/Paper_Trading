const express = require("express");
const { createUser, getUser } = require("../controllers/userController");

const router = express.Router();

router.post("/create-user", createUser);
router.get("/user/:id", getUser);

module.exports = router;
