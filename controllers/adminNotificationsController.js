const { User } = require("../models/userModel");
const { Pet } = require("../models/petModel");
const ScheduledNotification = require("../models/ScheduledNotificationModel");
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
          sound: sound || "hayotush_notification",
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

module.exports = {
  sendImmediateNotification,
  scheduleNotification,
  getScheduledNotifications,
  deleteScheduledNotification,
  getNotificationStats,
};
