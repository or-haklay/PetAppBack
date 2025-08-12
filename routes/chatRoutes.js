// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const { chatWithBot } = require("../controllers/chatController");

router.post("/", chatWithBot);

module.exports = router;
