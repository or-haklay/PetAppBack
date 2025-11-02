const { User } = require("../models/userModel");
const { Pet } = require("../models/petModel");
const ScheduledNotification = require("../models/ScheduledNotificationModel");
const { Notification } = require("../models/NotificationModel");
const pushService = require("../utils/pushNotificationService");

// שליחת התראה מיידית
const sendImmediateNotification = async (req, res) => {
  try {
    const { title, body, targetAudience, userIds, sound, type } = req.body;

    // בניית query לפי קהל יעד
    let query = { pushToken: { $exists: true, $ne: null } };

    switch (targetAudience) {
      case "inactive":
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        query.lastAppActivity = { $lt: oneDayAgo };
        break;
      case "dog_owners":
        const dogOwners = await Pet.find({ species: "dog" }).distinct("owner");
        query._id = { $in: dogOwners };
        break;
      case "cat_owners":
        const catOwners = await Pet.find({ species: "cat" }).distinct("owner");
        query._id = { $in: catOwners };
        break;
      case "specific":
        query._id = { $in: userIds };
        break;
      // "all" - השאר query כמו שהוא
    }

    const users = await User.find(query, { pushToken: 1 }).lean();

    let sentCount = 0;
    for (const user of users) {
      try {
        await pushService.sendPushNotification({
          to: user.pushToken,
          title,
          body,
          type: type || "announcement",
          userId: user._id || user.id,
          data: { type: type || "announcement" },
        });
        sentCount++;
      } catch (error) {
        console.error(`Failed to send to user ${user._id}:`, error.message);
      }
    }

    res.json({
      success: true,
      totalUsers: users.length,
      sentCount,
    });
  } catch (error) {
    console.error("Error sending immediate notification:", error);
    res.status(500).json({ message: "שגיאה בשליחת התראה" });
  }
};

// תזמון התראה עתידית
const scheduleNotification = async (req, res) => {
  try {
    const notification = new ScheduledNotification(req.body);
    await notification.save();

    res.status(201).json({
      success: true,
      notification,
      message: "התראה נשמרה ותישלח במועד הקבוע",
    });
  } catch (error) {
    res.status(500).json({ message: "שגיאה בשמירת התראה" });
  }
};

// קבלת רשימת התראות מתוזמנות
const getScheduledNotifications = async (req, res) => {
  try {
    const notifications = await ScheduledNotification.find()
      .sort({ scheduledFor: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "שגיאה בקבלת התראות" });
  }
};

// מחיקת התראה מתוזמנת
const deleteScheduledNotification = async (req, res) => {
  try {
    await ScheduledNotification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "שגיאה במחיקת התראה" });
  }
};

// סטטיסטיקות התראות
const getNotificationStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({
      pushToken: { $exists: true, $ne: null },
    });
    const inactiveUsers = await User.countDocuments({
      lastAppActivity: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      pushToken: { $exists: true, $ne: null },
    });

    const dogOwners = await Pet.countDocuments({ species: "dog" });
    const catOwners = await Pet.countDocuments({ species: "cat" });

    const pendingNotifications = await ScheduledNotification.countDocuments({
      sent: false,
    });
    const sentToday = await ScheduledNotification.countDocuments({
      sent: true,
      sentAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });

    res.json({
      totalUsers,
      inactiveUsers,
      dogOwners,
      catOwners,
      pendingNotifications,
      sentToday,
    });
  } catch (error) {
    res.status(500).json({ message: "שגיאה בקבלת סטטיסטיקות" });
  }
};

// קבלת היסטוריית התראות (admin)
const getNotificationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build query
    const query = { isDeleted: false };
    
    if (type && type !== "all") {
      query.type = type;
    }

    if (startDate || endDate) {
      query.scheduledFor = {};
      if (startDate) {
        query.scheduledFor.$gte = new Date(startDate);
      }
      if (endDate) {
        query.scheduledFor.$lte = new Date(endDate);
      }
    }

    // Get notifications with user info
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate("userId", "name email")
        .sort({ scheduledFor: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(query),
    ]);

    // Get scheduled notifications that were sent
    const scheduledQuery = { sent: true };
    if (type && type !== "all") {
      scheduledQuery.type = type;
    }
    if (startDate || endDate) {
      scheduledQuery.sentAt = {};
      if (startDate) {
        scheduledQuery.sentAt.$gte = new Date(startDate);
      }
      if (endDate) {
        scheduledQuery.sentAt.$lte = new Date(endDate);
      }
    }

    const [scheduledNotifications, scheduledTotal] = await Promise.all([
      ScheduledNotification.find(scheduledQuery)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ScheduledNotification.countDocuments(scheduledQuery),
    ]);

    // Combine and format
    const allNotifications = [
      ...notifications.map((n) => ({
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        scheduledFor: n.scheduledFor,
        createdAt: n.createdAt,
        userId: n.userId?._id,
        userName: n.userId?.name,
        userEmail: n.userId?.email,
        recipients: 1, // Single notification
        status: n.isRead ? "read" : "unread",
        source: "direct",
      })),
      ...scheduledNotifications.map((n) => ({
        _id: n._id,
        title: n.title,
        message: n.body,
        type: n.type || "general",
        priority: "medium",
        scheduledFor: n.scheduledFor,
        createdAt: n.createdAt,
        sentAt: n.sentAt,
        recipients: n.sentCount || 0,
        status: "sent",
        source: "scheduled",
        targetAudience: n.targetAudience,
      })),
    ].sort((a, b) => {
      const dateA = a.sentAt || a.scheduledFor || a.createdAt;
      const dateB = b.sentAt || b.scheduledFor || b.createdAt;
      return new Date(dateB) - new Date(dateA);
    }).slice(0, Number(limit));

    res.json({
      success: true,
      notifications: allNotifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: total + scheduledTotal,
        pages: Math.ceil((total + scheduledTotal) / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting notification history:", error);
    res.status(500).json({ message: "שגיאה בקבלת היסטוריית התראות" });
  }
};

/**
 * יצירת התראות ראשוניות לדוגמה
 * POST /admin/notifications/create-sample
 */
const createSampleNotifications = async (req, res, next) => {
  try {
    const { count = 10 } = req.body;

    // Find some users (with or without push tokens - we're just creating notifications in DB)
    const users = await User.find({})
      .limit(10)
      .select("_id name")
      .lean();

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "לא נמצאו משתמשים במערכת",
      });
    }

    const sampleNotifications = [
      {
        title: "תזכורת: זמן לטיול!",
        message: "עברו יותר מ-2 ימים מאז הטיול האחרון עם החיה שלך",
        type: "walk",
        priority: "high",
      },
      {
        title: "תזכורת חיסון שנתי",
        message: "זמן לחיסון השנתי עבור החיה שלך",
        type: "reminder",
        priority: "high",
      },
      {
        title: "טיפ יומי",
        message: "זכור לבדוק את משקל החיה שלך באופן קבוע",
        type: "tip",
        priority: "low",
      },
      {
        title: "רשומה רפואית חדשה",
        message: "תזכורת: בדיקה רפואית שנתית מומלצת",
        type: "medical",
        priority: "medium",
      },
      {
        title: "תשומת לב: הוצאה גבוהה",
        message: "ההוצאה האחרונה גבוהה מהממוצע החודשי",
        type: "expense",
        priority: "medium",
      },
      {
        title: "חיותוש: אנו כאן בשבילך",
        message: "לא פתחת את האפליקציה זמן רב. החיה שלך מחכה לך!",
        type: "engagement",
        priority: "low",
      },
      {
        title: "תזכורת: בדיקה רפואית",
        message: "זמן לבדיקה רפואית שנתית עבור החיה שלך",
        type: "medical",
        priority: "high",
      },
      {
        title: "טיפ יומי: פעילות גופנית",
        message: "טיול יומי חשוב לבריאות החיה שלך",
        type: "tip",
        priority: "low",
      },
      {
        title: "תזכורת: חיסון",
        message: "חיסון רב-שנתי מומלץ עבור החיה שלך",
        type: "reminder",
        priority: "high",
      },
      {
        title: "עדכון מהאפליקציה",
        message: "יש לך התראות חדשות באפליקציה. לחץ לפתיחה",
        type: "general",
        priority: "medium",
      },
    ];

    const notifications = [];
    const now = new Date();

    // Create notifications for random users
    for (let i = 0; i < Math.min(count, sampleNotifications.length); i++) {
      const sample = sampleNotifications[i];
      const randomUser = users[Math.floor(Math.random() * users.length)];

      // Random date in the last 7 days
      const randomDaysAgo = Math.floor(Math.random() * 7);
      const scheduledDate = new Date(now.getTime() - randomDaysAgo * 24 * 60 * 60 * 1000);

      notifications.push({
        userId: randomUser._id,
        title: sample.title,
        message: sample.message,
        type: sample.type,
        priority: sample.priority,
        scheduledFor: scheduledDate,
        isRead: Math.random() > 0.7, // 30% chance of being read
        sound: "hayotush_notification",
      });
    }

    const savedNotifications = await Notification.insertMany(notifications);

    res.json({
      success: true,
      message: `נוצרו ${savedNotifications.length} התראות לדוגמה`,
      notifications: savedNotifications.length,
    });
  } catch (error) {
    console.error("Error creating sample notifications:", error);
    const dbError = new Error("שגיאה ביצירת התראות לדוגמה");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

module.exports = {
  sendImmediateNotification,
  scheduleNotification,
  getScheduledNotifications,
  deleteScheduledNotification,
  getNotificationStats,
  getNotificationHistory,
  createSampleNotifications,
};
