const express = require("express");
const router = express.Router();
const {
  getSummary,
  registerEvent,
} = require("../controllers/gamificationController");

// נניח שיש לך middleware אימות JWT/Session שמגדיר req.user
const { authMW } = require("../middleware/authMW");

router.get("/summary", authMW, getSummary);
router.post("/event", authMW, registerEvent);

module.exports = router;
