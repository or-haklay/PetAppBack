const express = require("express");
const router = express.Router();
const { authMW } = require("../middleware/authMW");
const { adminMW } = require("../middleware/adminMW");
const {
  getStats,
  getUsersList,
  updateUserRole,
  blockUser,
  deleteUserAdmin,
  createArticle,
  updateArticle,
  deleteArticle,
  getArticlesList,
  getCategoriesList,
  createCategory,
  updateCategory,
  deleteCategory,
  sendNotification,
  broadcastNotification,
  getSystemInfo,
  getAnalytics,
  getUserAnalytics,
  getContentAnalytics,
  getRevenueAnalytics,
  getServerLogs,
} = require("../controllers/adminController");
const {
  getAllNotificationSettings,
  getNotificationSettingByType,
  updateNotificationSettingByType,
  toggleNotificationSetting,
  initializeSettings,
} = require("../controllers/notificationSettingsController");
const {
  getNotificationHistory,
  getNotificationStats,
  createSampleNotifications,
} = require("../controllers/adminNotificationsController");
const {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  initializeTemplates,
  sendFromTemplate,
} = require("../controllers/notificationTemplateController");
const {
  getAllAutomatedNotifications,
  getAutomatedNotificationById,
  createAutomatedNotification,
  updateAutomatedNotification,
  deleteAutomatedNotification,
  toggleAutomatedNotification,
  checkAutomatedNotification,
} = require("../controllers/automatedNotificationController");

// סטטיסטיקות
router.get("/stats", authMW, adminMW, getStats);

// ניהול משתמשים
router.get("/users", authMW, adminMW, getUsersList);
router.put("/users/:id", authMW, adminMW, updateUserRole);
router.post("/users/:id/block", authMW, adminMW, blockUser);
router.delete("/users/:id", authMW, adminMW, deleteUserAdmin);

// ניהול מאמרים
router.get("/content/articles", authMW, adminMW, getArticlesList);
router.post("/content/articles", authMW, adminMW, createArticle);
router.put("/content/articles/:id", authMW, adminMW, updateArticle);
router.delete("/content/articles/:id", authMW, adminMW, deleteArticle);

// ניהול קטגוריות
router.get("/content/categories", authMW, adminMW, getCategoriesList);
router.post("/content/categories", authMW, adminMW, createCategory);
router.put("/content/categories/:id", authMW, adminMW, updateCategory);
router.delete("/content/categories/:id", authMW, adminMW, deleteCategory);

// שליחת התראות
router.post("/notifications/send", authMW, adminMW, sendNotification);
router.post("/notifications/broadcast", authMW, adminMW, broadcastNotification);

// היסטוריית התראות
router.get("/notifications/history", authMW, adminMW, getNotificationHistory);
router.get("/notifications/stats", authMW, adminMW, getNotificationStats);
router.post("/notifications/create-sample", authMW, adminMW, createSampleNotifications);

// ניהול תבניות התראות
router.get("/notifications/templates", authMW, adminMW, getAllTemplates);
router.get("/notifications/templates/:id", authMW, adminMW, getTemplateById);
router.post("/notifications/templates", authMW, adminMW, createTemplate);
router.put("/notifications/templates/:id", authMW, adminMW, updateTemplate);
router.delete("/notifications/templates/:id", authMW, adminMW, deleteTemplate);
router.post("/notifications/templates/initialize", authMW, adminMW, initializeTemplates);
router.post("/notifications/templates/:id/send", authMW, adminMW, sendFromTemplate);

// ניהול הגדרות התראות
router.get("/notifications/settings", authMW, adminMW, getAllNotificationSettings);
router.get("/notifications/settings/:type", authMW, adminMW, getNotificationSettingByType);
router.put("/notifications/settings/:type", authMW, adminMW, updateNotificationSettingByType);
router.put("/notifications/settings/:type/toggle", authMW, adminMW, toggleNotificationSetting);
router.post("/notifications/settings/initialize", authMW, adminMW, initializeSettings);

// ניהול התראות קבועות (Automated Notifications)
router.get("/notifications/automated", authMW, adminMW, getAllAutomatedNotifications);
router.get("/notifications/automated/:id", authMW, adminMW, getAutomatedNotificationById);
router.post("/notifications/automated", authMW, adminMW, createAutomatedNotification);
router.put("/notifications/automated/:id", authMW, adminMW, updateAutomatedNotification);
router.delete("/notifications/automated/:id", authMW, adminMW, deleteAutomatedNotification);
router.post("/notifications/automated/:id/toggle", authMW, adminMW, toggleAutomatedNotification);
router.post("/notifications/automated/:id/check", authMW, adminMW, checkAutomatedNotification);

// מערכת וסטטיסטיקות
router.get("/system/info", authMW, adminMW, getSystemInfo);
router.get("/system/logs", authMW, adminMW, getServerLogs);
router.get("/analytics", authMW, adminMW, getAnalytics);
router.get("/analytics/users", authMW, adminMW, getUserAnalytics);
router.get("/analytics/content", authMW, adminMW, getContentAnalytics);
router.get("/analytics/revenue", authMW, adminMW, getRevenueAnalytics);

module.exports = router;
