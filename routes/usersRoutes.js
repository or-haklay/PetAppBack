const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const { authMW } = require("../middleware/authMW");

// סדר מומלץ: קודם ראוטים סטטיים, אחר כך פרמטריים
router.post("/login", usersController.loginUser);
router.post("/", usersController.createUser);

// פרופיל עצמי
router.get("/me", authMW, usersController.getCurrentUser);
router.get("/profile", authMW, usersController.getCurrentUser); // Alias for /me
router.patch("/me", authMW, usersController.updateMe);
router.post("/change-password", authMW, usersController.changePassword);

// Activity and notification preferences
router.post("/activity", authMW, usersController.updateLastActivity);
router.put(
  "/notification-preferences",
  authMW,
  usersController.updateNotificationPreferences
);

// Consent management routes
router.get("/consent-status", authMW, usersController.getConsentStatus);
router.post("/update-consent", authMW, usersController.updateConsent);

// Push notifications
router.post("/push-token", authMW, usersController.updatePushToken);

// Social connections
router.get("/social-connections", authMW, usersController.getSocialConnections);

// אדמין/ניהול וכללי
router.get("/", authMW, usersController.getAllUsers);
router.get("/:id", authMW, usersController.getUserById);
router.put("/:id", authMW, usersController.updateUser);
router.delete("/:id", authMW, usersController.deleteUser);

module.exports = router;
