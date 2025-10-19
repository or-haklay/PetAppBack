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
} = require("../controllers/adminController");

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

// מערכת וסטטיסטיקות
router.get("/system/info", authMW, adminMW, getSystemInfo);
router.get("/analytics", authMW, adminMW, getAnalytics);
router.get("/analytics/users", authMW, adminMW, getUserAnalytics);
router.get("/analytics/content", authMW, adminMW, getContentAnalytics);
router.get("/analytics/revenue", authMW, adminMW, getRevenueAnalytics);

module.exports = router;
