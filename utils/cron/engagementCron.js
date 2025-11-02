const cron = require("node-cron");
const { processInactiveUsers } = require("../engagementService");
const { User } = require("../../models/userModel");
const { Pet } = require("../../models/petModel");
const ScheduledNotification = require("../../models/ScheduledNotificationModel");
const pushService = require("../pushNotificationService");

function scheduleEngagementNotifications() {
  // פעם אחת ביום ב-09:00 בבוקר
  cron.schedule(
    "0 9 * * *",
    async () => {
      console.log("[CRON] Starting engagement notifications at 09:00");
      await processInactiveUsers();
    },
    {
      timezone: "Asia/Jerusalem",
    }
  );

  console.log("✅ Engagement notifications scheduled: daily at 09:00");
}

// פונקציה לשליחת התראות מתוזמנות
async function sendScheduledNotifications() {
  try {
    const now = new Date();

    // מצא התראות שצריך לשלוח
    const notifications = await ScheduledNotification.find({
      scheduledFor: { $lte: now },
      sent: false,
    });

    console.log(
      `[Scheduled] Found ${notifications.length} notifications to send`
    );

    for (const notification of notifications) {
      try {
        // בניית query לפי קהל יעד
        let query = { pushToken: { $exists: true, $ne: null } };

        switch (notification.targetAudience) {
          case "inactive":
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query.lastAppActivity = { $lt: oneDayAgo };
            break;
          case "dog_owners":
            const dogOwners = await Pet.find({ species: "dog" }).distinct(
              "owner"
            );
            query._id = { $in: dogOwners };
            break;
          case "cat_owners":
            const catOwners = await Pet.find({ species: "cat" }).distinct(
              "owner"
            );
            query._id = { $in: catOwners };
            break;
          case "specific":
            query._id = { $in: notification.specificUserIds };
            break;
          // "all" - השאר query כמו שהוא
        }

        const users = await User.find(query, { pushToken: 1 }).lean();

        let sentCount = 0;
        for (const user of users) {
          try {
            await pushService.sendPushNotification({
              to: user.pushToken,
              title: notification.title,
              body: notification.body,
              type: notification.type || "engagement",
              userId: user._id || user.id,
              data: { type: notification.type || "engagement" },
            });
            sentCount++;
          } catch (error) {
            console.error(
              `[Scheduled] Failed to send to user ${user._id}:`,
              error.message
            );
          }
        }

        // עדכן שנשלח
        await ScheduledNotification.updateOne(
          { _id: notification._id },
          { sent: true, sentAt: new Date(), sentCount }
        );

        console.log(
          `[Scheduled] Sent notification "${notification.title}" to ${sentCount} users`
        );
      } catch (error) {
        console.error(`[Scheduled] Error sending notification:`, error);
      }
    }
  } catch (error) {
    console.error("[Scheduled] Error in sendScheduledNotifications:", error);
  }
}

// הוסף cron חדש שרץ כל 15 דקות
function scheduleNotificationChecks() {
  cron.schedule("*/15 * * * *", sendScheduledNotifications, {
    timezone: "Asia/Jerusalem",
  });
  console.log("✅ Scheduled notifications check: every 15 minutes");
}

module.exports = {
  scheduleEngagementNotifications,
  scheduleNotificationChecks,
};
