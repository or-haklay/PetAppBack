const cron = require("node-cron");
const { Notification } = require("../../models/NotificationModel");
const { Reminder } = require("../../models/ReminderModel");
const { TZ, getILDateKey } = require("../timezone");

// שירות Push Notifications (ייבא בהמשך)
let pushNotificationService = null;

async function getPushNotificationService() {
  if (!pushNotificationService) {
    try {
      pushNotificationService = require("../pushNotificationService");
    } catch (error) {
      console.warn("Push notification service not available:", error.message);
    }
  }
  return pushNotificationService;
}

// פונקציה לשליחת התראות תזכורות
async function sendReminderNotifications() {
  try {
    console.log(
      `[CRON] Starting reminder notifications check at ${new Date().toISOString()}`
    );

    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000); // 5 דקות קדימה

    // מציאת התראות שצריכות להישלח
    const notificationsToSend = await Notification.find({
      type: "reminder",
      isRead: false,
      isDeleted: false,
      scheduledFor: {
        $gte: now,
        $lte: fiveMinutesFromNow,
      },
    })
      .populate("userId", "email firstName lastName pushToken")
      .lean();

    console.log(
      `[CRON] Found ${notificationsToSend.length} notifications to send`
    );

    let sentCount = 0;
    let errorCount = 0;

    for (const notification of notificationsToSend) {
      try {
        // שליחת התראה Push (אם זמין)
        const pushService = await getPushNotificationService();
        if (pushService && notification.userId?.pushToken) {
          await pushService.sendPushNotification({
            to: notification.userId.pushToken,
            title: notification.title,
            body: notification.message,
            data: {
              type: "reminder",
              reminderId: notification.relatedId,
              notificationId: notification._id,
            },
          });
        }

        // סימון ההתראה כנקראה (כי נשלחה)
        await Notification.findByIdAndUpdate(notification._id, {
          isRead: true,
          lastSentAt: new Date(),
        });

        sentCount++;
        console.log(
          `[CRON] Sent notification for reminder ${notification.relatedId} to user ${notification.userId._id}`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `[CRON] Error sending notification ${notification._id}:`,
          error.message
        );
      }
    }

    console.log(
      `[CRON] Reminder notifications completed: ${sentCount} sent, ${errorCount} errors`
    );
  } catch (error) {
    console.error("[CRON] Error in sendReminderNotifications:", error);
  }
}

// פונקציה לניקוי התראות ישנות
async function cleanupOldNotifications() {
  try {
    console.log(
      `[CRON] Starting cleanup of old notifications at ${new Date().toISOString()}`
    );

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // מחיקת התראות ישנות שנקראו
    const deletedCount = await Notification.deleteMany({
      isRead: true,
      isDeleted: false,
      createdAt: { $lt: thirtyDaysAgo },
    });

    console.log(
      `[CRON] Cleaned up ${deletedCount.deletedCount} old notifications`
    );
  } catch (error) {
    console.error("[CRON] Error in cleanupOldNotifications:", error);
  }
}

// פונקציה ליצירת תזכורות חוזרות
async function createRecurringReminders() {
  try {
    console.log(
      `[CRON] Starting recurring reminders creation at ${new Date().toISOString()}`
    );

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // מציאת תזכורות שצריכות חזרה
    const remindersToRepeat = await Reminder.find({
      repeatInterval: { $ne: "none" },
      isCompleted: true,
      date: { $lt: today },
    }).lean();

    let createdCount = 0;

    for (const reminder of remindersToRepeat) {
      try {
        let nextDate = new Date(reminder.date);

        // חישוב התאריך הבא לפי סוג החזרה
        switch (reminder.repeatInterval) {
          case "daily":
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case "yearly":
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
          default:
            continue;
        }

        // יצירת תזכורת חדשה
        const newReminder = new Reminder({
          userId: reminder.userId,
          petId: reminder.petId,
          title: reminder.title,
          description: reminder.description,
          date: nextDate,
          time: reminder.time,
          repeatInterval: reminder.repeatInterval,
          timezone: reminder.timezone,
          syncWithGoogle: reminder.syncWithGoogle,
        });

        await newReminder.save();

        // יצירת התראה חדשה
        const notification = new Notification({
          userId: reminder.userId,
          title: `תזכורת חדשה: ${newReminder.title}`,
          message: newReminder.description || "נוצרה תזכורת חדשה",
          type: "reminder",
          relatedId: newReminder._id,
          scheduledFor: newReminder.date,
          priority: "medium",
        });

        await notification.save();

        // עדכון התזכורת המקורית
        await Reminder.findByIdAndUpdate(reminder._id, {
          isCompleted: false,
          date: nextDate,
        });

        createdCount++;
        console.log(
          `[CRON] Created recurring reminder ${newReminder._id} for user ${reminder.userId}`
        );
      } catch (error) {
        console.error(
          `[CRON] Error creating recurring reminder for ${reminder._id}:`,
          error.message
        );
      }
    }

    console.log(`[CRON] Created ${createdCount} recurring reminders`);
  } catch (error) {
    console.error("[CRON] Error in createRecurringReminders:", error);
  }
}

// הגדרת הקרונז'בים
function scheduleReminderNotifications() {
  // שליחת התראות כל 5 דקות
  cron.schedule("*/5 * * * *", sendReminderNotifications, { timezone: TZ });

  // ניקוי התראות ישנות כל יום ב-02:00
  cron.schedule("0 2 * * *", cleanupOldNotifications, { timezone: TZ });

  // יצירת תזכורות חוזרות כל יום ב-01:00
  cron.schedule("0 1 * * *", createRecurringReminders, { timezone: TZ });

  console.log("⏰ Reminder notifications scheduler started");
  console.log("   - Sending notifications: every 5 minutes");
  console.log("   - Cleanup old notifications: daily at 02:00");
  console.log("   - Create recurring reminders: daily at 01:00");
}

module.exports = {
  scheduleReminderNotifications,
  sendReminderNotifications,
  cleanupOldNotifications,
  createRecurringReminders,
};
