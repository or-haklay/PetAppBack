const express = require("express");
const { authMW } = require("../middleware/authMW.js");
const {
  getUserNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} = require("../controllers/notificationsController.js");

const router = express.Router();

// כל הרווטים דורשים אימות
router.use(authMW);

// קבלת התראות
router.get("/", getUserNotifications);

// יצירת התראה חדשה
router.post("/", createNotification);

// סימון התראה כנקראה
router.patch("/:id/read", markAsRead);

// סימון כל ההתראות כנקראו
router.patch("/mark-all-read", markAllAsRead);

// מחיקת התראה
router.delete("/:id", deleteNotification);

// מחיקת כל ההתראות
router.delete("/", deleteAllNotifications);

module.exports = router;
