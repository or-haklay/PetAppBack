const express = require("express");
const router = express.Router();
const c = require("../controllers/remindersController");
const { authMW } = require("../middleware/authMW");

router.use(authMW);

router.get("/", c.getAllReminders);
router.post("/", c.addReminder);
router.put("/:reminderId", c.updateReminder);
router.patch("/:reminderId/complete", c.completeReminder);
router.delete("/:reminderId", c.deleteReminder);

module.exports = router;
