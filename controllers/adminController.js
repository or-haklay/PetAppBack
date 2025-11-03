const { User } = require("../models/userModel");
const { ContentArticle, ContentCategory } = require("../models/contentModels");
const { Notification } = require("../models/NotificationModel");
const pushNotificationService = require("../utils/pushNotificationService");
const mongoose = require("mongoose");
const fs = require("fs").promises;
const path = require("path");
const logger = require("../utils/logger");

// Get comprehensive admin statistics
const getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // User statistics
    const [
      totalUsers,
      newUsersLast30Days,
      newUsersLast7Days,
      premiumUsers,
      activeUsers,
      adminUsers,
      usersBefore30Days,
      activeUsersBefore7Days,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({
        subscriptionPlan: { $in: ["premium", "gold"] },
        subscriptionExpiresAt: { $gt: now },
      }),
      User.countDocuments({ lastActive: { $gte: sevenDaysAgo } }),
      User.countDocuments({ isAdmin: true }),
      // Users that existed before 30 days ago (created before 60 days ago)
      User.countDocuments({ createdAt: { $lt: sixtyDaysAgo } }),
      // Active users 7-14 days ago
      User.countDocuments({ lastActive: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } }),
    ]);

    // Content statistics
    const [
      totalArticles,
      publishedArticles,
      unpublishedArticles,
      totalCategories,
      activeCategories,
      articles30DaysAgo,
    ] = await Promise.all([
      ContentArticle.countDocuments(),
      ContentArticle.countDocuments({ published: true }),
      ContentArticle.countDocuments({ published: false }),
      ContentCategory.countDocuments(),
      ContentCategory.countDocuments({ active: true }),
      ContentArticle.countDocuments({
        createdAt: { $lt: thirtyDaysAgo },
      }),
    ]);

    // Calculate growth percentages
    // For user growth: compare total users now vs users that existed before 30 days ago
    const users30DaysAgo = usersBefore30Days; // Users created before 60 days ago
    const userGrowth =
      users30DaysAgo > 0
        ? ((totalUsers - users30DaysAgo) / users30DaysAgo) * 100
        : newUsersLast30Days > 0 ? 100 : 0; // If no previous users, 100% growth or 0%

    // For active user growth: compare current active vs active 7-14 days ago
    const previousActiveUsers = activeUsersBefore7Days;
    const activeGrowth =
      previousActiveUsers > 0
        ? ((activeUsers - previousActiveUsers) / previousActiveUsers) * 100
        : activeUsers > 0 ? 100 : 0;

    const previousArticles = articles30DaysAgo;
    const articleGrowth =
      previousArticles > 0
        ? ((totalArticles - previousArticles) / previousArticles) * 100
        : 0;

    // Calculate revenue (basic calculation based on premium users)
    // This is a simplified calculation - in production you'd want actual revenue data
    const monthlyRevenue = premiumUsers * 29.99; // Assuming average monthly subscription

    // Recent activity
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email createdAt subscriptionPlan")
      .lean();

    const recentArticles = await ContentArticle.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .select("title categoryKey updatedAt published")
      .lean();

    // Monthly user growth (last 6 months)
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const count = await User.countDocuments({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      monthlyGrowth.push({
        month: startOfMonth.toLocaleDateString("he-IL", {
          month: "short",
          year: "numeric",
        }),
        count,
      });
    }

    // Subscription distribution
    const subscriptionStats = await User.aggregate([
      {
        $group: {
          _id: "$subscriptionPlan",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      ok: true,
      stats: {
        users: {
          total: totalUsers,
          newLast30Days: newUsersLast30Days,
          newLast7Days: newUsersLast7Days,
          premium: premiumUsers,
          active: activeUsers,
          admin: adminUsers,
          growth: Math.round(userGrowth * 100) / 100,
          activeGrowth: Math.round(activeGrowth * 100) / 100,
        },
        content: {
          articles: totalArticles, // Also include as 'articles' for compatibility
          totalArticles,
          publishedArticles,
          unpublishedArticles,
          totalCategories,
          activeCategories,
          articleGrowth: Math.round(articleGrowth * 100) / 100,
        },
        revenue: {
          monthly: Math.round(monthlyRevenue * 100) / 100,
          growth: activeGrowth, // Use active growth as revenue growth indicator
        },
        recentActivity: {
          users: recentUsers,
          articles: recentArticles,
        },
        charts: {
          monthlyGrowth,
          subscriptionDistribution: subscriptionStats,
        },
      },
    });
  } catch (error) {
    logger.error(`getStats error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error("Database error occurred while fetching stats");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get users list with filters and pagination
const getUsersList = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      subscriptionPlan = "",
      isAdmin = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    if (subscriptionPlan) {
      filter.subscriptionPlan = subscriptionPlan;
    }

    if (isAdmin !== "") {
      filter.isAdmin = isAdmin === "true";
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error(`getUsersList error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error("Database error occurred while fetching users");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Update user role/subscription
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      isAdmin,
      subscriptionPlan,
      subscriptionExpiresAt,
      points,
      coins,
      name,
      email,
    } = req.body;

    const updateData = {};

    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
    if (subscriptionPlan !== undefined)
      updateData.subscriptionPlan = subscriptionPlan;
    if (subscriptionExpiresAt !== undefined)
      updateData.subscriptionExpiresAt = subscriptionExpiresAt;
    if (points !== undefined) updateData.points = points;
    if (coins !== undefined) updateData.coins = coins;
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email: email,
        _id: { $ne: id },
      });
      if (existingUser) {
        const error = new Error("Email already exists");
        error.statusCode = 400;
        return next(error);
      }
      updateData.email = email;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).select("-password");

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      ok: true,
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    logger.error(`updateUserRole error: ${error.message}`, { error, stack: error.stack, userId: req.params.id });
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000 || error.name === "MongoServerError") {
      const dbError = new Error("Email already exists");
      dbError.statusCode = 400;
      return next(dbError);
    }
    const dbError = new Error("Database error occurred while updating user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Block/unblock user
const blockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { blocked: blocked } },
      { new: true }
    ).select("-password");

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      ok: true,
      message: `User ${blocked ? "blocked" : "unblocked"} successfully`,
      user,
    });
  } catch (error) {
    logger.error(`blockUser error: ${error.message}`, { error, stack: error.stack, userId: req.params.id });
    const dbError = new Error("Database error occurred while blocking user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Delete user (admin only)
const deleteUserAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting other admins
    const user = await User.findById(id);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    if (user.isAdmin && user._id.toString() !== req.user._id) {
      const error = new Error("Cannot delete another admin user");
      error.statusCode = 403;
      return next(error);
    }

    await User.findByIdAndDelete(id);

    res.json({
      ok: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error(`deleteUserAdmin error: ${error.message}`, { error, stack: error.stack, userId: req.params.id });
    const dbError = new Error("Database error occurred while deleting user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Create article
const createArticle = async (req, res, next) => {
  try {
    const articleData = req.body;

    // Validate required fields
    if (!articleData.title) {
      const error = new Error("Title is required");
      error.statusCode = 400;
      return next(error);
    }

    if (!articleData.categoryKey) {
      const error = new Error("Category is required");
      error.statusCode = 400;
      return next(error);
    }

    // Validate that category exists
    const category = await ContentCategory.findOne({
      key: articleData.categoryKey,
    });
    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      return next(error);
    }

    // Generate slug if not provided
    if (!articleData.slug) {
      articleData.slug = articleData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .trim();
    }

    // Ensure unique slug
    let slug = articleData.slug;
    let counter = 1;
    while (await ContentArticle.findOne({ slug })) {
      slug = `${articleData.slug}-${counter}`;
      counter++;
    }
    articleData.slug = slug;

    const article = new ContentArticle(articleData);
    await article.save();

    res.status(201).json({
      ok: true,
      message: "Article created successfully",
      article,
    });
  } catch (error) {
    logger.error(`createArticle error: ${error.message}`, { error, stack: error.stack, articleData: req.body });
    
    // Handle duplicate key errors (slug)
    if (error.code === 11000 || error.name === "MongoServerError") {
      const dbError = new Error("Article slug already exists");
      dbError.statusCode = 400;
      return next(dbError);
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const dbError = new Error(`Validation error: ${error.message}`);
      dbError.statusCode = 400;
      return next(dbError);
    }
    
    // If error already has statusCode, pass it along
    if (error.statusCode) {
      return next(error);
    }
    
    const dbError = new Error("Database error occurred while creating article");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Update article
const updateArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If categoryKey is being updated, validate that category exists
    if (updateData.categoryKey) {
      const category = await ContentCategory.findOne({
        key: updateData.categoryKey,
      });
      if (!category) {
        const error = new Error("Category not found");
        error.statusCode = 404;
        return next(error);
      }
    }

    // If slug is being updated, ensure it's unique
    if (updateData.slug) {
      const existingArticle = await ContentArticle.findOne({
        slug: updateData.slug,
        _id: { $ne: id },
      });
      if (existingArticle) {
        const error = new Error("Article slug already exists");
        error.statusCode = 400;
        return next(error);
      }
    }

    const article = await ContentArticle.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!article) {
      const error = new Error("Article not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      ok: true,
      message: "Article updated successfully",
      article,
    });
  } catch (error) {
    console.error("updateArticle error:", error);
    
    // Handle duplicate key errors (slug)
    if (error.code === 11000 || error.name === "MongoServerError") {
      const dbError = new Error("Article slug already exists");
      dbError.statusCode = 400;
      return next(dbError);
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const dbError = new Error(`Validation error: ${error.message}`);
      dbError.statusCode = 400;
      return next(dbError);
    }
    
    // If error already has statusCode, pass it along
    if (error.statusCode) {
      return next(error);
    }
    
    const dbError = new Error("Database error occurred while updating article");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Delete article
const deleteArticle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await ContentArticle.findByIdAndDelete(id);

    if (!article) {
      const error = new Error("Article not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      ok: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    console.error("deleteArticle error:", error);
    const dbError = new Error("Database error occurred while deleting article");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get articles list for admin
const getArticlesList = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      category = "",
      published = "",
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { title: new RegExp(search, "i") },
        { summary: new RegExp(search, "i") },
        { tags: new RegExp(search, "i") },
      ];
    }

    if (category) {
      filter.categoryKey = category;
    }

    if (published !== "") {
      filter.published = published === "true";
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);

    const [articles, total] = await Promise.all([
      ContentArticle.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ContentArticle.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      articles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getArticlesList error:", error);
    const dbError = new Error(
      "Database error occurred while fetching articles"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Create category
const getCategoriesList = async (req, res, next) => {
  try {
    const categories = await ContentCategory.find({})
      .sort({ order: 1, title: 1 })
      .lean();

    res.json({
      ok: true,
      categories,
    });
  } catch (error) {
    logger.error(`getCategoriesList error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error(
      "Database error occurred while fetching categories"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const categoryData = req.body;

    // Validate required fields
    if (!categoryData.key) {
      const error = new Error("Category key is required");
      error.statusCode = 400;
      return next(error);
    }

    if (!categoryData.title) {
      const error = new Error("Category title is required");
      error.statusCode = 400;
      return next(error);
    }

    // Check if key already exists
    const existingCategory = await ContentCategory.findOne({
      key: categoryData.key,
    });
    if (existingCategory) {
      const error = new Error("Category key already exists");
      error.statusCode = 400;
      return next(error);
    }

    const category = new ContentCategory(categoryData);
    await category.save();

    res.status(201).json({
      ok: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("createCategory error:", error);
    
    // Handle duplicate key errors
    if (error.code === 11000 || error.name === "MongoServerError") {
      const dbError = new Error("Category key already exists");
      dbError.statusCode = 400;
      return next(dbError);
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const dbError = new Error(`Validation error: ${error.message}`);
      dbError.statusCode = 400;
      return next(dbError);
    }
    
    // If error already has statusCode, pass it along
    if (error.statusCode) {
      return next(error);
    }
    
    const dbError = new Error(
      "Database error occurred while creating category"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Update category
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const category = await ContentCategory.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      ok: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("updateCategory error:", error);
    const dbError = new Error(
      "Database error occurred while updating category"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Delete category
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // First, find the category to get its key
    const category = await ContentCategory.findById(id);
    
    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      return next(error);
    }

    // Check if category has articles using the category key
    const articleCount = await ContentArticle.countDocuments({
      categoryKey: category.key,
    });
    
    if (articleCount > 0) {
      const error = new Error(
        `Cannot delete category with ${articleCount} existing article${articleCount > 1 ? 's' : ''}. Please remove or reassign articles first.`
      );
      error.statusCode = 400;
      return next(error);
    }

    // Delete the category
    await ContentCategory.findByIdAndDelete(id);

    res.json({
      ok: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    logger.error(`deleteCategory error: ${error.message}`, { error, stack: error.stack, categoryId: req.params.id });
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const dbError = new Error("Category key already exists");
      dbError.statusCode = 400;
      return next(dbError);
    }
    
    // If error already has statusCode, pass it along
    if (error.statusCode) {
      return next(error);
    }
    
    const dbError = new Error(
      "Database error occurred while deleting category"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Send notification to specific users
const sendNotification = async (req, res, next) => {
  try {
    const {
      userIds,
      targetType = "all", // all, premium, specific
      title,
      message,
      type = "general",
      priority = "medium",
      scheduledFor,
    } = req.body;

    // בדיקה אם בוחרים "specific" אבל לא נתנו userIds
    if (targetType === "specific") {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        const error = new Error("User IDs are required when targetType is 'specific'");
        error.statusCode = 400;
        return next(error);
      }
    }

    if (!title || !message) {
      const error = new Error("Title and message are required");
      error.statusCode = 400;
      return next(error);
    }

    // בניית query לפי targetType
    let userQuery = {};
    let finalUserIds = userIds || [];

    if (targetType === "all") {
      // כל המשתמשים עם push token
      userQuery = { pushToken: { $exists: true, $ne: null } };
    } else if (targetType === "premium") {
      // משתמשים פרימיום בלבד - premium או gold עם מנוי פעיל
      const now = new Date();
      userQuery = {
        pushToken: { $exists: true, $ne: null },
        subscriptionPlan: { $in: ["premium", "gold"] },
        $or: [
          { subscriptionExpiresAt: { $exists: false } }, // אין תאריך תפוגה = מנוי לכל החיים
          { subscriptionExpiresAt: null }, // תאריך תפוגה null = מנוי לכל החיים
          { subscriptionExpiresAt: { $gt: now } }, // מנוי שעדיין פעיל
        ],
      };
    } else if (targetType === "specific") {
      // משתמשים ספציפיים לפי userIds
      userQuery = { _id: { $in: userIds } };
      finalUserIds = userIds;
    }

    // מצא את כל המשתמשים המתאימים
    console.log(`🔍 [sendNotification] targetType: ${targetType}, userQuery:`, JSON.stringify(userQuery, null, 2));
    const allUsers = await User.find(userQuery).select("_id pushToken pushNotificationsEnabled subscriptionPlan subscriptionExpiresAt").lean();
    console.log(`✅ [sendNotification] Found ${allUsers.length} users matching criteria`);

    // אם targetType הוא specific, וודא שיש משתמשים
    if (targetType === "specific" && allUsers.length === 0) {
      const error = new Error("No users found with the provided user IDs");
      error.statusCode = 400;
      return next(error);
    }

    // עדכן את finalUserIds לפי המשתמשים שנמצאו
    if (targetType !== "specific") {
      finalUserIds = allUsers.map((u) => u._id.toString());
    }

    // אם אין משתמשים בכלל, חזור שגיאה עם הודעה יותר ברורה
    if (finalUserIds.length === 0) {
      let errorMessage = "No users found matching the criteria";
      if (targetType === "premium") {
        errorMessage = "No premium users found with active subscriptions and push tokens. Please check that users have premium/gold subscription and push notifications enabled.";
      } else if (targetType === "all") {
        errorMessage = "No users found with push tokens. Please ensure users have enabled push notifications.";
      }
      const error = new Error(errorMessage);
      error.statusCode = 400;
      return next(error);
    }

    const scheduleDate = scheduledFor ? new Date(scheduledFor) : new Date();

    // Helper function to replace variables in text
    const replaceVariables = (text, userData) => {
      if (!text) return "";
      let result = text;
      // Find all variables like {key}
      const variableRegex = /\{([^}]+)\}/g;
      const matches = result.match(variableRegex);
      if (matches) {
        matches.forEach((match) => {
          const key = match.slice(1, -1); // Remove { and }
          const value = userData[key];
          if (value !== undefined && value !== null && value !== "") {
            result = result.replace(new RegExp(`\\{${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`, "g"), value.toString());
          }
        });
      }
      return result;
    };

    // Helper function to get user-specific data for variable replacement
    const getUserDataForNotification = async (userId) => {
      const userData = {};
      try {
        const user = await User.findById(userId).select("name").lean();
        if (user) {
          userData.userName = user.name || "";
          userData.userName_heb = user.name || "";
        }

        // Get user's pets
        const { Pet } = require("../models/petModel");
        const pets = await Pet.find({ owner: userId }).select("name").lean();
        if (pets && pets.length > 0) {
          const firstPet = pets[0];
          userData.petName = firstPet.name || "";
          userData.firstPetName = firstPet.name || "";
          if (pets.length > 1) {
            userData.petNames = pets.map((p) => p.name).join(", ");
          } else {
            userData.petNames = firstPet.name || "";
          }
        } else {
          userData.petName = "";
          userData.firstPetName = "";
          userData.petNames = "";
        }
      } catch (error) {
        console.error(`Error getting user data for ${userId}:`, error);
      }
      return userData;
    };

    // Create notifications in database with variable replacement
    const notificationsToSave = [];
    for (const userId of finalUserIds) {
      try {
        // Get user-specific data for variable replacement
        const userData = await getUserDataForNotification(userId.toString());
        
        // Replace variables in title and message
        const personalizedTitle = replaceVariables(title, userData);
        const personalizedMessage = replaceVariables(message, userData);

        notificationsToSave.push({
          userId,
          title: personalizedTitle,
          message: personalizedMessage,
          type,
          priority,
          scheduledFor: scheduleDate,
        });
      } catch (error) {
        console.error(`Error preparing notification for user ${userId}:`, error);
        // Fallback: save without variable replacement
        notificationsToSave.push({
          userId,
          title,
          message,
          type,
          priority,
          scheduledFor: scheduleDate,
        });
      }
    }

    const savedNotifications = await Notification.insertMany(notificationsToSave);

    // Send push notifications if scheduled for now
    if (scheduleDate <= new Date()) {
      let sentCount = 0;
      let savedToDbCount = 0;

      // Send push notifications to users with tokens
      for (const user of allUsers) {
        try {
          // Save notification to DB for all users
          savedToDbCount++;

          logger.info(`Checking user ${user._id}: pushToken=${!!user.pushToken}, pushNotificationsEnabled=${user.pushNotificationsEnabled}`);

          // Only send push if user has token and notifications enabled
          if (user.pushToken && user.pushNotificationsEnabled) {
            logger.info(`Sending push notification to user ${user._id}`);
            
            // Get personalized title and message for this user
            const userDataForPush = await getUserDataForNotification(user._id.toString());
            const personalizedTitle = replaceVariables(title, userDataForPush);
            const personalizedMessage = replaceVariables(message, userDataForPush);

            const result = await pushNotificationService.sendPushNotification({
              to: user.pushToken,
              title: personalizedTitle,
              body: personalizedMessage,
              type: type || "general",
              userId: user._id || user.id,
              data: { type: type || "general", priority },
            });

            if (result.success) {
              sentCount++;
              logger.info(`Push notification sent successfully to user ${user._id}`);
            } else {
              logger.warn(`Push notification failed for user ${user._id}: ${result.error || result.skipped}`);
            }
          } else {
            if (!user.pushToken) {
              logger.warn(`User ${user._id} has no push token`);
            }
            if (!user.pushNotificationsEnabled) {
              logger.warn(`User ${user._id} has push notifications disabled`);
            }
          }
        } catch (error) {
          logger.error(`Failed to send notification to user ${user._id}: ${error.message}`, { error, stack: error.stack, userId: user._id });
        }
      }

      // Update response to include sent/saved counts
      return res.json({
        success: true,
        ok: true,
        message: `Notification sent to ${sentCount} users, saved to DB for ${savedToDbCount} users`,
        notifications: savedNotifications,
        sentCount,
        savedToDbCount,
      });
    }

    // If scheduled for future, just return success
    res.json({
      success: true,
      ok: true,
      message: `Notification scheduled for ${finalUserIds.length} users`,
      notifications: savedNotifications,
      sentCount: 0,
      savedToDbCount: finalUserIds.length,
    });
  } catch (error) {
    logger.error(`sendNotification error: ${error.message}`, { error, stack: error.stack, notificationData: req.body });
    const dbError = new Error(
      "Database error occurred while sending notification"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Broadcast notification to all users
const broadcastNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      type = "general",
      priority = "medium",
      scheduledFor,
      subscriptionPlan = "", // Optional filter by subscription
    } = req.body;

    if (!title || !message) {
      const error = new Error("Title and message are required");
      error.statusCode = 400;
      return next(error);
    }

    // Build user filter
    const userFilter = {
      pushNotificationsEnabled: true,
    };

    if (subscriptionPlan) {
      userFilter.subscriptionPlan = subscriptionPlan;
    }

    const users = await User.find(userFilter).select("_id pushToken");

    if (users.length === 0) {
      const error = new Error("No users found matching criteria");
      error.statusCode = 404;
      return next(error);
    }

    const userIds = users.map((user) => user._id);
    const scheduleDate = scheduledFor ? new Date(scheduledFor) : new Date();

    // Create notifications in database
    const notifications = userIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      priority,
      scheduledFor: scheduleDate,
    }));

    const savedNotifications = await Notification.insertMany(notifications);

    // Send push notifications if scheduled for now
    if (scheduleDate <= new Date()) {
      const usersWithTokens = users.filter((user) => user.pushToken);
      
      logger.info(`Broadcast: Found ${users.length} users with pushNotificationsEnabled=true, ${usersWithTokens.length} users have push tokens, ${users.length - usersWithTokens.length} users missing push tokens`);

      if (usersWithTokens.length === 0) {
        logger.warn(`Broadcast: No users with push tokens found. Users have pushNotificationsEnabled=true but no tokens registered.`);
        return res.json({
          ok: true,
          message: `Notification saved to DB for ${userIds.length} users, but no push tokens found to send push notifications`,
          notifications: savedNotifications,
          sentCount: 0,
          savedToDbCount: userIds.length,
        });
      }

      const pushNotifications = usersWithTokens.map((user) => ({
        to: user.pushToken,
        title,
        body: message,
        type: type || "general",
        userId: user._id || user.id,
        data: { type: type || "general", priority },
      }));

      logger.info(`Broadcast: Attempting to send ${pushNotifications.length} push notifications`);

      if (pushNotifications.length > 0) {
        const bulkResult = await pushNotificationService.sendBulkPushNotifications(
          pushNotifications
        );
        
        logger.info(`Broadcast result: ${JSON.stringify(bulkResult)}`);
        
        // Handle both old and new return format
        const results = bulkResult.results || bulkResult;
        const totalSent = (results.expo?.sent || 0) + (results.fcm?.sent || 0);
        const totalFailed = (results.expo?.failed || 0) + (results.fcm?.failed || 0);
        const totalSkipped = (results.expo?.skipped || 0) + (results.fcm?.skipped || 0);
        
        return res.json({
          ok: true,
          message: `Notification broadcasted: ${totalSent} sent, ${totalFailed} failed, ${totalSkipped} skipped, ${userIds.length} saved to DB`,
          notifications: savedNotifications,
          sentCount: totalSent,
          failedCount: totalFailed,
          skippedCount: totalSkipped,
          savedToDbCount: userIds.length,
        });
      }
    }

    res.json({
      ok: true,
      message: `Notification broadcasted to ${userIds.length} users`,
      notifications: savedNotifications,
    });
  } catch (error) {
    logger.error(`broadcastNotification error: ${error.message}`, { error, stack: error.stack, notificationData: req.body });
    const dbError = new Error(
      "Database error occurred while broadcasting notification"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get system information
const getSystemInfo = async (req, res, next) => {
  try {
    // Get system information
    const systemInfo = {
      server: {
        status: "online",
        uptime: process.uptime(),
        version: process.version,
        memory: {
          used:
            Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
            100,
          total:
            Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
            100,
        },
        cpu: Math.round(Math.random() * 100), // Mock CPU usage
        disk: {
          used: Math.round(Math.random() * 100), // Mock disk usage
          total: 100,
        },
      },
      database: {
        status: "connected",
        size: "2.3 GB", // Mock database size
        connections: Math.floor(Math.random() * 20) + 5,
        queries: Math.floor(Math.random() * 10000) + 5000,
      },
      logs: [
        {
          id: 1,
          level: "info",
          message: "System started successfully",
          timestamp: new Date().toLocaleString("he-IL"),
        },
        {
          id: 2,
          level: "info",
          message: "Database connection established",
          timestamp: new Date().toLocaleString("he-IL"),
        },
      ],
    };

    res.json({
      ok: true,
      systemInfo,
    });
  } catch (error) {
    logger.error(`getSystemInfo error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error(
      "Database error occurred while fetching system info"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get analytics data
const getAnalytics = async (req, res, next) => {
  try {
    const { range = "7d" } = req.query;

    // Get analytics data based on time range
    const analytics = {
      users: {
        total: await User.countDocuments(),
        new: await User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
        active: await User.countDocuments({
          lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        }),
        premium: await User.countDocuments({
          subscriptionPlan: { $in: ["premium", "gold"] },
        }),
        growth: 12.5, // Mock growth rate
      },
      content: {
        articles: await ContentArticle.countDocuments(),
        views: 15420, // Mock total views
        engagement: 8.5, // Mock engagement rate
        topCategory: "בריאות", // Mock top category
      },
      revenue: {
        monthly: 15420, // Mock monthly revenue
        yearly: 185000, // Mock yearly revenue
        conversion: 12.5, // Mock conversion rate
        averageOrder: 89.5, // Mock average order value
      },
    };

    res.json({
      ok: true,
      analytics,
    });
  } catch (error) {
    logger.error(`getAnalytics error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error(
      "Database error occurred while fetching analytics"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get user analytics
const getUserAnalytics = async (req, res, next) => {
  try {
    const userAnalytics = {
      total: await User.countDocuments(),
      new: await User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      active: await User.countDocuments({
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
      premium: await User.countDocuments({
        subscriptionPlan: { $in: ["premium", "gold"] },
      }),
      free: await User.countDocuments({ subscriptionPlan: "free" }),
      blocked: await User.countDocuments({ isBlocked: true }),
    };

    res.json({
      ok: true,
      userAnalytics,
    });
  } catch (error) {
    logger.error(`getUserAnalytics error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error(
      "Database error occurred while fetching user analytics"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get content analytics
const getContentAnalytics = async (req, res, next) => {
  try {
    const contentAnalytics = {
      articles: await ContentArticle.countDocuments(),
      published: await ContentArticle.countDocuments({ published: true }),
      drafts: await ContentArticle.countDocuments({ published: false }),
      categories: await ContentCategory.countDocuments(),
      totalViews: 15420, // Mock total views
      engagement: 8.5, // Mock engagement rate
      topCategory: "בריאות", // Mock top category
    };

    res.json({
      ok: true,
      contentAnalytics,
    });
  } catch (error) {
    logger.error(`getContentAnalytics error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error(
      "Database error occurred while fetching content analytics"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get revenue analytics
const getRevenueAnalytics = async (req, res, next) => {
  try {
    const revenueAnalytics = {
      monthly: 15420, // Mock monthly revenue
      yearly: 185000, // Mock yearly revenue
      conversion: 12.5, // Mock conversion rate
      averageOrder: 89.5, // Mock average order value
      premiumUsers: await User.countDocuments({
        subscriptionPlan: { $in: ["premium", "gold"] },
      }),
      freeUsers: await User.countDocuments({ subscriptionPlan: "free" }),
    };

    res.json({
      ok: true,
      revenueAnalytics,
    });
  } catch (error) {
    logger.error(`getRevenueAnalytics error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error(
      "Database error occurred while fetching revenue analytics"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get server logs
const getServerLogs = async (req, res, next) => {
  try {
    const { date, limit = 100, level } = req.query;
    const logsDir = path.join(__dirname, "..", "logs");

    // Check if logs directory exists
    let files = [];
    try {
      files = await fs.readdir(logsDir);
    } catch (error) {
      // Logs directory doesn't exist or can't be read
      return res.json({
        ok: true,
        logs: [],
        total: 0,
        availableDates: [],
        pagination: {
          limit: parseInt(limit),
          returned: 0,
        },
        message: "Logs directory not found or empty",
      });
    }
    const logFiles = files
      .filter((file) => file.endsWith("-error.log") || file.endsWith(".log"))
      .sort()
      .reverse(); // Most recent first

    let allLogs = [];

    // If date is specified, read that specific file
    if (date) {
      const logFile = path.join(logsDir, `${date}-error.log`);
      try {
        const content = await fs.readFile(logFile, "utf8");
        const lines = content
          .split("\n")
          .filter((line) => line.trim())
          .map((line, index) => {
            // Parse log format: timestamp | LEVEL | message
            const parts = line.split(" | ");
            return {
              id: `${date}-${index}`,
              level: parts[1]?.toLowerCase() || "error",
              message: parts.slice(2).join(" | ") || line,
              timestamp: parts[0] || new Date().toISOString(),
              date,
            };
          })
          .filter((log) => !level || log.level === level.toLowerCase())
          .reverse(); // Most recent first
        allLogs = lines;
      } catch (error) {
        // File doesn't exist
        allLogs = [];
      }
    } else {
      // Read most recent log files (up to last 3 days)
      for (const file of logFiles.slice(0, 3)) {
        try {
          const filePath = path.join(logsDir, file);
          const content = await fs.readFile(filePath, "utf8");
          const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
          const fileDate = dateMatch ? dateMatch[1] : file;

          const lines = content
            .split("\n")
            .filter((line) => line.trim())
            .map((line, index) => {
              const parts = line.split(" | ");
              return {
                id: `${fileDate}-${index}`,
                level: parts[1]?.toLowerCase() || "error",
                message: parts.slice(2).join(" | ") || line,
                timestamp: parts[0] || new Date().toISOString(),
                date: fileDate,
              };
            })
            .filter((log) => !level || log.level === level.toLowerCase());

          allLogs = [...allLogs, ...lines];
        } catch (error) {
          logger.error(`Error reading log file ${file}: ${error.message}`, { error, stack: error.stack, fileName: file });
        }
      }

      // Sort by timestamp (most recent first)
      allLogs.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA;
      });
    }

    // Limit results
    const limitedLogs = allLogs.slice(0, parseInt(limit));

    // Get available log file dates
    const availableDates = logFiles
      .map((file) => {
        const match = file.match(/(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
      })
      .filter((date) => date)
      .sort()
      .reverse();

    res.json({
      ok: true,
      logs: limitedLogs,
      total: allLogs.length,
      availableDates,
      pagination: {
        limit: parseInt(limit),
        returned: limitedLogs.length,
      },
    });
  } catch (error) {
    logger.error(`getServerLogs error: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error("Error reading server logs");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

module.exports = {
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
};
