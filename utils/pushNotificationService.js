const { Expo } = require("expo-server-sdk");

class PushNotificationService {
  constructor() {
    this.expo = new Expo();
  }

  // שליחת התראה Push למשתמש יחיד
  async sendPushNotification({ to, title, body, data = {} }) {
    try {
      // בדיקה שהטוקן תקין
      if (!Expo.isExpoPushToken(to)) {
        console.error(`Push token ${to} is not a valid Expo push token`);
        return { success: false, error: "Invalid push token" };
      }

      // יצירת הודעה
      const message = {
        to,
        sound: "default",
        title,
        body,
        data,
        priority: "high",
        channelId: "reminders",
      };

      // שליחת ההודעה
      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error("Error sending push notification chunk:", error);
        }
      }

      console.log(`Push notification sent to ${to}: ${title}`);
      return { success: true, tickets };
    } catch (error) {
      console.error("Error sending push notification:", error);
      return { success: false, error: error.message };
    }
  }

  // שליחת התראות למספר משתמשים
  async sendBulkPushNotifications(notifications) {
    try {
      const validTokens = notifications.filter((n) =>
        Expo.isExpoPushToken(n.to)
      );
      const invalidTokens = notifications.filter(
        (n) => !Expo.isExpoPushToken(n.to)
      );

      if (invalidTokens.length > 0) {
        console.warn(`Found ${invalidTokens.length} invalid push tokens`);
      }

      if (validTokens.length === 0) {
        return { success: false, error: "No valid push tokens" };
      }

      const chunks = this.expo.chunkPushNotifications(validTokens);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error("Error sending bulk push notifications:", error);
        }
      }

      console.log(`Sent ${validTokens.length} push notifications`);
      return { success: true, tickets, invalidTokens: invalidTokens.length };
    } catch (error) {
      console.error("Error sending bulk push notifications:", error);
      return { success: false, error: error.message };
    }
  }

  // בדיקת סטטוס של התראות שנשלחו
  async checkNotificationStatus(ticketIds) {
    try {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(
        ticketIds
      );

      const results = {
        delivered: 0,
        failed: 0,
        errors: [],
      };

      for (const receiptId in receipts) {
        const receipt = receipts[receiptId];

        if (receipt.status === "ok") {
          results.delivered++;
        } else if (receipt.status === "error") {
          results.failed++;
          results.errors.push({
            ticketId: receiptId,
            error: receipt.message,
          });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error("Error checking notification status:", error);
      return { success: false, error: error.message };
    }
  }

  // שליחת התראה לתזכורת ספציפית
  async sendReminderNotification(user, reminder) {
    const message = {
      to: user.pushToken,
      title: `תזכורת: ${reminder.title}`,
      body: reminder.description || "זמן לתזכורת שלך!",
      data: {
        type: "reminder",
        reminderId: reminder._id.toString(),
        petId: reminder.petId.toString(),
      },
    };

    return await this.sendPushNotification(message);
  }

  // שליחת התראה לרשומה רפואית
  async sendMedicalRecordNotification(user, medicalRecord) {
    const message = {
      to: user.pushToken,
      title: `רשומה רפואית: ${medicalRecord.title}`,
      body: medicalRecord.description || "רשומה רפואית חדשה",
      data: {
        type: "medical",
        medicalRecordId: medicalRecord._id.toString(),
        petId: medicalRecord.petId.toString(),
      },
    };

    return await this.sendPushNotification(message);
  }

  // שליחת התראה להוצאה
  async sendExpenseNotification(user, expense) {
    const message = {
      to: user.pushToken,
      title: `הוצאה חדשה: ${expense.description}`,
      body: `סכום: ₪${expense.amount}`,
      data: {
        type: "expense",
        expenseId: expense._id.toString(),
        petId: expense.petId.toString(),
      },
    };

    return await this.sendPushNotification(message);
  }
}

module.exports = new PushNotificationService();
