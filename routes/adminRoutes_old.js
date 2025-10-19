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
  createCategory,
  updateCategory,
  deleteCategory,
  sendNotification,
  broadcastNotification,
} = require("../controllers/adminController");

// All admin routes require authentication and admin privileges
router.use(authMW);
router.use(adminMW);

// Statistics
router.get("/stats", getStats);

// Users management
router.get("/users", getUsersList);
router.put("/users/:id", updateUserRole);
router.post("/users/:id/block", blockUser);
router.delete("/users/:id", deleteUserAdmin);

// Content management
router.get("/content/articles", getArticlesList);
router.post("/content/articles", createArticle);
router.put("/content/articles/:id", updateArticle);
router.delete("/content/articles/:id", deleteArticle);

router.get("/content/categories", async (req, res, next) => {
  try {
    const { ContentCategory } = require("../models/contentModels");
    const categories = await ContentCategory.find().sort({
      order: 1,
      title: 1,
    });
    res.json({ ok: true, categories });
  } catch (error) {
    console.error("getCategories error:", error);
    const dbError = new Error(
      "Database error occurred while fetching categories"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
});

router.post("/content/categories", createCategory);
router.put("/content/categories/:id", updateCategory);
router.delete("/content/categories/:id", deleteCategory);

// Notifications
router.post("/notifications/send", sendNotification);
router.post("/notifications/broadcast", broadcastNotification);

module.exports = router;
