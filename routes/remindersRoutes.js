const express = require("express");
const router = express.Router();
const remindersController = require("../controllers/remindersController");
const { authMW } = require("../middleware/authMW");

/* router.post("/:id", authMW, remindersController.addReminder);
 */
module.exports = router;
