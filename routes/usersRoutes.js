const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const { authMW } = require("../middleware/authMW");

// סדר מומלץ: קודם ראוטים סטטיים, אחר כך פרמטריים
router.post("/login", usersController.loginUser);
router.post("/", usersController.createUser);

// פרופיל עצמי
router.get("/me", authMW, usersController.getCurrentUser);
router.patch("/me", authMW, usersController.updateMe);
router.post("/change-password", authMW, usersController.changePassword);

// אדמין/ניהול וכללי
router.get("/", authMW, usersController.getAllUsers);
router.get("/:id", authMW, usersController.getUserById);
router.put("/:id", authMW, usersController.updateUser);
router.delete("/:id", authMW, usersController.deleteUser);

module.exports = router;
