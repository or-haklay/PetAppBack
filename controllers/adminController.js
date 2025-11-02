const { User } = require("../models/userModel");
const { ContentArticle, ContentCategory } = require("../models/contentModels");
const { Notification } = require("../models/NotificationModel");
const pushNotificationService = require("../utils/pushNotificationService");
const mongoose = require("mongoose");

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
    console.error("getStats error:", error);
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
    console.error("getUsersList error:", error);
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
    console.error("updateUserRole error:", error);
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
    console.error("blockUser error:", error);
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
    console.error("deleteUserAdmin error:", error);
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
    console.error("createArticle error:", error);
    
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
    console.error("getCategoriesList error:", error);
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
    console.error("deleteCategory error:", error);
    
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
      title,
      message,
      type = "general",
      priority = "medium",
      scheduledFor,
    } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      const error = new Error("User IDs are required");
      error.statusCode = 400;
      return next(error);
    }

    if (!title || !message) {
      const error = new Error("Title and message are required");
      error.statusCode = 400;
      return next(error);
    }

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
      // Get all users (not just those with push tokens) to save notifications in DB
      const allUsers = await User.find({
        _id: { $in: userIds },
      }).select("pushToken _id pushNotificationsEnabled");

      let sentCount = 0;
      let savedToDbCount = 0;

      // Send push notifications to users with tokens
      for (const user of allUsers) {
        try {
          // Save notification to DB for all users
          savedToDbCount++;

          // Only send push if user has token and notifications enabled
          if (user.pushToken && user.pushNotificationsEnabled) {
            const result = await pushNotificationService.sendPushNotification({
              to: user.pushToken,
              title,
              body: message,
              type: type || "general",
              userId: user._id || user.id,
              data: { type: type || "general", priority },
            });

            if (result.success) {
              sentCount++;
            }
          }
        } catch (error) {
          console.error(`Failed to send notification to user ${user._id}:`, error.message);
        }
      }

      // Update response to include sent/saved counts
      return res.json({
        ok: true,
        message: `Notification sent to ${sentCount} users, saved to DB for ${savedToDbCount} users`,
        notifications: savedNotifications,
        sentCount,
        savedToDbCount,
      });
    }

    // If scheduled for future, just return success
    res.json({
      ok: true,
      message: `Notification scheduled for ${userIds.length} users`,
      notifications: savedNotifications,
    });
  } catch (error) {
    console.error("sendNotification error:", error);
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

      const pushNotifications = usersWithTokens.map((user) => ({
        to: user.pushToken,
        title,
        body: message,
        type: type || "general",
        userId: user._id || user.id,
        data: { type: type || "general", priority },
      }));

      if (pushNotifications.length > 0) {
        await pushNotificationService.sendBulkPushNotifications(
          pushNotifications
        );
      }
    }

    res.json({
      ok: true,
      message: `Notification broadcasted to ${userIds.length} users`,
      notifications: savedNotifications,
    });
  } catch (error) {
    console.error("broadcastNotification error:", error);
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
    console.error("getSystemInfo error:", error);
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
    console.error("getAnalytics error:", error);
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
    console.error("getUserAnalytics error:", error);
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
    console.error("getContentAnalytics error:", error);
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
    console.error("getRevenueAnalytics error:", error);
    const dbError = new Error(
      "Database error occurred while fetching revenue analytics"
    );
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
};
