const {
  Notification,
  notificationCreate,
  notificationUpdate,
} = require("../models/NotificationModel.js");
const Joi = require("joi");

// קבלת כל ההתראות של המשתמש
const getUserNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 50, onlyUnread = false } = req.query;

    const query = {
      userId: req.user._id,
      isDeleted: false,
    };

    if (onlyUnread === "true") {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Error getting notifications:", error);
    res.status(500).json({ message: "שגיאה בקבלת ההתראות" });
  }
};

// יצירת התראה חדשה
const createNotification = async (req, res) => {
  try {
    const { error, value } = notificationCreate.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const notification = new Notification({
      ...value,
      userId: req.user._id,
    });

    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ message: "שגיאה ביצירת ההתראה" });
  }
};

// סימון התראה כנקראה
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "ההתראה לא נמצאה" });
    }

    res.json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "שגיאה בסימון ההתראה" });
  }
};

// סימון כל ההתראות כנקראו
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false, isDeleted: false },
      { isRead: true }
    );

    res.json({ message: "כל ההתראות סומנו כנקראו" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "שגיאה בסימון ההתראות" });
  }
};

// מחיקת התראה
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isDeleted: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "ההתראה לא נמצאה" });
    }

    res.json({ message: "ההתראה נמחקה בהצלחה" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "שגיאה במחיקת ההתראה" });
  }
};

// מחיקת כל ההתראות
const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isDeleted: false },
      { isDeleted: true }
    );

    res.json({ message: "כל ההתראות נמחקו בהצלחה" });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    res.status(500).json({ message: "שגיאה במחיקת ההתראות" });
  }
};

module.exports = {
  getUserNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};
