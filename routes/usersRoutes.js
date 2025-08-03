const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const { authMW, requireSubscriptionMW } = require("../middleware/authMW");

router.get("/", authMW, usersController.getAllUsers);
router.get("/:id", authMW, usersController.getUserById);
router.post("/", usersController.createUser);
router.post("/login", usersController.loginUser);
router.put("/:id", authMW, usersController.updateUser);
router.delete("/:id", authMW, usersController.deleteUser);

module.exports = router;
