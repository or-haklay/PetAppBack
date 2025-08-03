const express = require("express");
const router = express.Router();
const remindersController = require("../controllers/remindersController");
const { authMW } = require("../middleware/authMW");
const findAndAuthPet = require("../middleware/petAuthMW");

router.post("/:petId", authMW, findAndAuthPet, remindersController.addReminder);
router.get(
  "/:petId",
  authMW,
  findAndAuthPet,
  remindersController.getAllReminders
);
router.get(
  "/:petId/:reminderId",
  authMW,
  findAndAuthPet,
  remindersController.getReminderById
);
router.patch(
  "/:petId/:reminderId",
  authMW,
  findAndAuthPet,
  remindersController.changeReminderStatus
);
router.put(
  "/:petId/:reminderId",
  authMW,
  findAndAuthPet,
  remindersController.updateReminder
);
router.delete(
  "/:petId/:reminderId",
  authMW,
  findAndAuthPet,
  remindersController.deleteReminder
);

module.exports = router;
