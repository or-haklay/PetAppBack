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

    // User statistics
    const [
      totalUsers,
      newUsersLast30Days,
      newUsersLast7Days,
      premiumUsers,
      activeUsers,
      adminUsers,
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
    ]);

    // Content statistics
    const [
      totalArticles,
      publishedArticles,
      unpublishedArticles,
      totalCategories,
      activeCategories,
    ] = await Promise.all([
      ContentArticle.countDocuments(),
      ContentArticle.countDocuments({ published: true }),
      ContentArticle.countDocuments({ published: false }),
      ContentCategory.countDocuments(),
      ContentCategory.countDocuments({ active: true }),
    ]);

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
        },
        content: {
          totalArticles,
          publishedArticles,
          unpublishedArticles,
          totalCategories,
          activeCategories,
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
    const { isAdmin, subscriptionPlan, subscriptionExpiresAt, points, coins } =
      req.body;

    const updateData = {};

    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
    if (subscriptionPlan !== undefined)
      updateData.subscriptionPlan = subscriptionPlan;
    if (subscriptionExpiresAt !== undefined)
      updateData.subscriptionExpiresAt = subscriptionExpiresAt;
    if (points !== undefined) updateData.points = points;
    if (coins !== undefined) updateData.coins = coins;

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

    const article = await ContentArticle.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
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

    const category = new ContentCategory(categoryData);
    await category.save();

    res.status(201).json({
      ok: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("createCategory error:", error);
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

    // Check if category has articles
    const articleCount = await ContentArticle.countDocuments({
      categoryKey: id,
    });
    if (articleCount > 0) {
      const error = new Error("Cannot delete category with existing articles");
      error.statusCode = 400;
      return next(error);
    }

    const category = await ContentCategory.findByIdAndDelete(id);

    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      ok: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("deleteCategory error:", error);
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
      const users = await User.find({
        _id: { $in: userIds },
        pushToken: { $exists: true, $ne: null },
        pushNotificationsEnabled: true,
      }).select("pushToken");

      const pushNotifications = users.map((user) => ({
        to: user.pushToken,
        title,
        body: message,
        data: { type, priority },
      }));

      if (pushNotifications.length > 0) {
        await pushNotificationService.sendBulkPushNotifications(
          pushNotifications
        );
      }
    }

    res.json({
      ok: true,
      message: `Notification sent to ${userIds.length} users`,
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
        data: { type, priority },
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
      published: await ContentArticle.countDocuments({ isPublished: true }),
      drafts: await ContentArticle.countDocuments({ isPublished: false }),
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
