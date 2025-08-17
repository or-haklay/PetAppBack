// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const {
  sendMessage,
  resetConversation,
} = require("../controllers/chatController");

router.post("/", sendMessage);
router.post("/reset", resetConversation);

module.exports = router;
