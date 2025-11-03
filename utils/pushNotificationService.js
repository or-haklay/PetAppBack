const { Expo } = require("expo-server-sdk");
const admin = require("firebase-admin");
const {
  isNotificationEnabled,
  canSendNotification,
  getNotificationSetting,
} = require("./notificationSettingsService");
const { Pet } = require("../models/petModel");
const { User } = require("../models/userModel");

class PushNotificationService {
  constructor() {
    this.expo = new Expo();
    this.firebaseAdmin = null;
    this.initializeFirebase();
  }

  // Initialize Firebase Admin SDK
  initializeFirebase() {
    try {
      // Check if Firebase Admin is already initialized
      if (admin.apps.length > 0) {
        this.firebaseAdmin = admin.apps[0];
        console.log("✅ Firebase Admin already initialized");
        return;
      }

      // Try to initialize with service account from environment variable or file
      // Option 1: Service Account JSON string in environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          this.firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          console.log("✅ Firebase Admin initialized from environment variable");
          return;
        } catch (error) {
          console.log("⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT:", error.message);
        }
      }

      // Option 2: FCM Server Key in environment variable (for HTTP API)
      if (process.env.FCM_SERVER_KEY) {
        // We'll use HTTP API for this case
        this.fcmServerKey = process.env.FCM_SERVER_KEY;
        console.log("✅ FCM Server Key configured");
        return;
      }

      // Option 3: Service Account file path (from env or common locations)
      const fs = require("fs");
      const path = require("path");
      
      const possiblePaths = [
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        // Primary location: in backend directory
        path.join(__dirname, "../petapp-de09c-firebase-adminsdk-fbsvc-6d57346403.json"),
        // Fallback: in root directory
        path.join(__dirname, "../../petapp-de09c-firebase-adminsdk-fbsvc-6d57346403.json"),
        // Generic service account names
        path.join(__dirname, "../firebase-service-account.json"),
        path.join(__dirname, "../../firebase-service-account.json"),
        // Look for any firebase admin SDK file in parent directory
        ...(() => {
          const parentDir = path.join(__dirname, "../../");
          try {
            const files = fs.readdirSync(parentDir);
            const serviceAccountFile = files.find((file) =>
              file.includes("firebase-adminsdk") && file.endsWith(".json")
            );
            if (serviceAccountFile) {
              return [path.join(parentDir, serviceAccountFile)];
            }
          } catch (err) {
            // Ignore errors reading directory
          }
          return [];
        })(),
      ].filter(Boolean); // Remove undefined/null values

      for (const filePath of possiblePaths) {
        try {
          if (fs.existsSync(filePath)) {
            const serviceAccount = require(filePath);
            this.firebaseAdmin = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
            console.log(`✅ Firebase Admin initialized from file: ${filePath}`);
            return;
          }
        } catch (error) {
          // Continue to next path
          continue;
        }
      }

      // Option 4: Default credentials (if running on Google Cloud)
      try {
        this.firebaseAdmin = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        console.log("✅ Firebase Admin initialized with default credentials");
      } catch (error) {
        console.log("⚠️ Firebase Admin not initialized. Will use Expo tokens only:", error.message);
      }
    } catch (error) {
      console.log("⚠️ Firebase Admin initialization failed:", error.message);
      console.log("📱 Will continue using Expo push notifications only");
    }
  }

  // Helper: Check if token is Expo token
  isExpoToken(token) {
    return Expo.isExpoPushToken(token);
  }

  // Helper: Check if token is FCM token (starts with specific patterns)
  isFCMToken(token) {
    if (!token || typeof token !== "string") return false;
    // FCM tokens are usually long strings that don't start with ExponentPushToken
    return !token.startsWith("ExponentPushToken") && token.length > 50;
  }

  // Send FCM notification via Firebase Admin SDK
  async sendFCMNotification({ to, title, body, data = {}, sound = "default" }) {
    try {
      if (!this.firebaseAdmin && !this.fcmServerKey) {
        throw new Error("Firebase Admin not initialized and FCM Server Key not configured");
      }

      const message = {
        notification: {
          title,
          body,
        },
        data: {
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {}),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "default",
            sound: sound === "hayotush_notification" ? sound : "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: sound === "hayotush_notification" ? sound : "default",
            },
          },
        },
        token: to,
      };

      // Use Firebase Admin SDK if available
      if (this.firebaseAdmin) {
        const response = await admin.messaging().send(message);
        console.log(`✅ FCM notification sent successfully: ${response}`);
        return { success: true, messageId: response };
      }

      // Fallback to HTTP API if only server key is available
      if (this.fcmServerKey) {
        const axios = require("axios");
        const response = await axios.post(
          "https://fcm.googleapis.com/v1/projects/petapp-de09c/messages:send",
          { message },
          {
            headers: {
              Authorization: `Bearer ${this.fcmServerKey}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log(`✅ FCM notification sent via HTTP API`);
        return { success: true, messageId: response.data.name };
      }
    } catch (error) {
      console.error("❌ Error sending FCM notification:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Send Expo notification
  async sendExpoNotification({
    to,
    title,
    body,
    data = {},
    sound = "default",
    priority = "high",
    channelId = "default",
  }) {
    try {
      if (!Expo.isExpoPushToken(to)) {
        throw new Error("Invalid Expo push token");
      }

      const message = {
        to,
        sound: sound,
        title,
        body,
        data,
        priority,
        channelId,
      };

      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          console.log(`📋 Expo tickets received:`, JSON.stringify(ticketChunk, null, 2));
        } catch (error) {
          console.error("❌ Error sending Expo push notification chunk:", error);
        }
      }

      // Check ticket status immediately to see if there are any errors
      if (tickets.length > 0) {
        const ticketIds = tickets
          .map((ticket, index) => ticket.id || index)
          .filter((id) => id !== undefined);
        
        if (ticketIds.length > 0) {
          console.log(`📋 Checking ticket status for ${ticketIds.length} tickets...`);
          try {
            const receiptIds = tickets
              .filter((ticket) => ticket.status === "ok" && ticket.id)
              .map((ticket) => ticket.id);
            
            if (receiptIds.length > 0) {
              // Wait a bit for Expo to process, then check receipts
              setTimeout(async () => {
                try {
                  const receiptChunks = await this.expo.getPushNotificationReceiptsAsync(receiptIds);
                  const receipts = Object.values(receiptChunks);
                  receipts.forEach((receipt, index) => {
                    if (receipt && receipt.status === "error") {
                      console.error(`❌ Expo notification delivery failed:`, {
                        error: receipt.message,
                        errorCode: receipt.details?.error,
                        ticketId: receiptIds[index],
                      });
                    } else if (receipt && receipt.status === "ok") {
                      console.log(`✅ Expo notification delivered successfully (ticket: ${receiptIds[index]})`);
                    }
                  });
                } catch (error) {
                  console.error("❌ Error checking Expo notification receipts:", error.message);
                }
              }, 3000); // Wait 3 seconds before checking receipts
            }
          } catch (error) {
            console.error("❌ Error processing ticket status:", error.message);
          }
        }
      }

      // Log any errors in tickets
      tickets.forEach((ticket, index) => {
        if (ticket.status === "error") {
          console.error(`❌ Expo ticket error:`, {
            error: ticket.message,
            errorCode: ticket.details?.error,
            details: ticket.details,
            ticketIndex: index,
          });
        }
      });

      console.log(`✅ Expo push notification sent to ${to}: ${title}`);
      return { success: true, tickets };
    } catch (error) {
      console.error("❌ Error sending Expo notification:", error.message);
      return { success: false, error: error.message };
    }
  }

  // שליחת התראה Push למשתמש יחיד - תומך בשני סוגי tokens
  async sendPushNotification({
    to,
    title,
    body,
    data = {},
    sound = "default",
    type = "general",
    userId = null,
  }) {
    try {
      if (!to) {
        return { success: false, error: "Push token is required" };
      }

      // בדיקת הגדרות אם יש type
      if (type && type !== "general") {
        // בודק אם סוג התראה מופעל
        const enabled = await isNotificationEnabled(type);
        if (!enabled) {
          return {
            success: false,
            error: `Notification type '${type}' is disabled`,
            skipped: true,
          };
        }

        // בודק תדירות ושעות אם יש userId
        if (userId) {
          const canSend = await canSendNotification(type, userId);
          if (!canSend.canSend) {
            console.log(`⏸️ Skipping notification - ${canSend.reason} (type: ${type})`);
            return {
              success: false,
              error: canSend.reason,
              skipped: true,
            };
          }
        }
      }

      // טעינת הגדרות לפי type
      let setting = null;
      let finalTitle = title;
      let finalBody = body;
      let finalSound = sound;
      let petName = null;

      if (type && type !== "general") {
        setting = await getNotificationSetting(type);

        // שימוש ב-titlePrefix אם יש
        if (setting.titlePrefix) {
          finalTitle = `${setting.titlePrefix} ${title}`.trim();
        }

        // שימוש ב-sound מההגדרות
        finalSound = setting.sound || sound;

        // הוספת שם חיה לתוכן אם יש petId ו-petNameInBody = true
        if (setting.petNameInBody && data.petId) {
          try {
            const pet = await Pet.findById(data.petId).select("name");
            if (pet && pet.name) {
              petName = pet.name;
              // מילוי פורמט שם החיה
              const petNameText = setting.petNameFormat.replace("{petName}", pet.name);
              finalBody = `${body} ${petNameText}`.trim();
            }
          } catch (error) {
            console.error("Error loading pet name:", error);
            // ממשיך בלי שם החיה
          }
        }
      }

      // עדכון data עם type ו-petName
      const finalData = {
        ...data,
        type: type || data.type || "general",
        ...(petName && { petName }),
      };

      // שליחה
      let result;
      if (this.isExpoToken(to)) {
        result = await this.sendExpoNotification({
          to,
          title: finalTitle,
          body: finalBody,
          data: finalData,
          sound: finalSound,
          priority: setting?.priority || "high",
          channelId: setting?.type || "default",
        });
      } else if (this.isFCMToken(to)) {
        result = await this.sendFCMNotification({
          to,
          title: finalTitle,
          body: finalBody,
          data: finalData,
          sound: finalSound,
        });
      } else {
        console.error(`❌ Invalid push token format: ${to.substring(0, 20)}...`);
        return { success: false, error: "Invalid push token format" };
      }

      // עדכון היסטוריית התראות אם השליחה הצליחה
      if (result.success && userId && type && type !== "general") {
        console.log(`📊 Updating notification history for user ${userId}, type: ${type}`);
        try {
          const user = await User.findById(userId);
          if (user) {
            if (!user.notificationHistory) {
              user.notificationHistory = {};
            }
            if (!user.notificationHistory[type]) {
              user.notificationHistory[type] = [];
            }

            // הוספת timestamp
            user.notificationHistory[type].push(new Date());

            // ניקוי timestamps ישנים (יותר מ-24 שעות)
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            user.notificationHistory[type] = user.notificationHistory[type].filter(
              (timestamp) => {
                const ts = timestamp instanceof Date ? timestamp : new Date(timestamp);
                return ts > dayAgo;
              }
            );

            // שמירה (ללא validation כדי למנוע שגיאות אם השדה לא קיים ב-schema)
            await user.save({ validateBeforeSave: false });
          }
        } catch (error) {
          console.error("Error updating notification history:", error);
          // לא נכשל אם זה נכשל - פשוט נמשיך
        }
      }

      return result;
    } catch (error) {
      console.error("❌ Error sending push notification:", error.message);
      return { success: false, error: error.message };
    }
  }

  // שליחת התראות למספר משתמשים - תומך בשני סוגי tokens
  async sendBulkPushNotifications(notifications) {
    try {
      console.log(`📤 Bulk push: Starting to send ${notifications.length} notifications...`);
      
      const expoTokens = [];
      const fcmTokens = [];
      const invalidTokens = [];

      // הפרדת tokens לפי סוג
      for (const notification of notifications) {
        if (this.isExpoToken(notification.to)) {
          expoTokens.push(notification);
        } else if (this.isFCMToken(notification.to)) {
          fcmTokens.push(notification);
        } else {
          invalidTokens.push(notification);
          console.warn(`⚠️ Invalid token format: ${notification.to.substring(0, 30)}...`);
        }
      }

      console.log(`📤 Bulk push: ${expoTokens.length} Expo tokens, ${fcmTokens.length} FCM tokens, ${invalidTokens.length} invalid tokens`);

      if (invalidTokens.length > 0) {
        console.warn(`⚠️ Found ${invalidTokens.length} invalid push tokens`);
      }

      const results = {
        expo: { sent: 0, failed: 0, skipped: 0 },
        fcm: { sent: 0, failed: 0, skipped: 0 },
      };

      // שליחת Expo tokens - צריך לבדוק כל אחד בנפרד בגלל תדירות
      if (expoTokens.length > 0) {
        console.log(`📤 Bulk push: Sending ${expoTokens.length} Expo notifications...`);
        for (const notification of expoTokens) {
          try {
            console.log(`📤 Sending Expo notification to ${notification.to.substring(0, 30)}... (userId: ${notification.userId})`);
            // Use sendPushNotification to check settings and frequency
            const result = await this.sendPushNotification(notification);
            
            // Check if tickets have errors (even if result.success is true)
            if (result.tickets && result.tickets.length > 0) {
              const hasErrors = result.tickets.some(ticket => ticket.status === "error");
              if (hasErrors) {
                const errorTicket = result.tickets.find(ticket => ticket.status === "error");
                results.expo.failed++;
                console.error(`❌ Expo notification failed (ticket error): ${errorTicket.message}`);
                console.error(`❌ Error details:`, errorTicket.details);
                continue;
              }
            }
            
            if (result.success) {
              results.expo.sent++;
              console.log(`✅ Expo notification sent successfully to ${notification.to.substring(0, 30)}...`);
            } else if (result.skipped) {
              results.expo.skipped++;
              console.log(`⏸️ Expo notification skipped: ${result.error}`);
            } else {
              results.expo.failed++;
              console.error(`❌ Expo notification failed: ${result.error}`);
            }
          } catch (error) {
            console.error(`❌ Error sending Expo notification to ${notification.to.substring(0, 30)}...:`, error.message);
            results.expo.failed++;
          }
        }
      }

      // שליחת FCM tokens - צריך לבדוק כל אחד בנפרד בגלל תדירות
      if (fcmTokens.length > 0) {
        console.log(`📤 Bulk push: Sending ${fcmTokens.length} FCM notifications...`);
        for (const notification of fcmTokens) {
          try {
            console.log(`📤 Sending FCM notification to ${notification.to.substring(0, 30)}... (userId: ${notification.userId})`);
            // Use sendPushNotification to check settings and frequency
            const result = await this.sendPushNotification(notification);
            if (result.success) {
              results.fcm.sent++;
              console.log(`✅ FCM notification sent successfully to ${notification.to.substring(0, 30)}...`);
            } else if (result.skipped) {
              results.fcm.skipped++;
              console.log(`⏸️ FCM notification skipped: ${result.error}`);
            } else {
              results.fcm.failed++;
              console.error(`❌ FCM notification failed: ${result.error}`);
            }
          } catch (error) {
            console.error(`❌ Error sending FCM notification to ${notification.to.substring(0, 30)}...:`, error.message);
            results.fcm.failed++;
          }
        }
      }

      const totalSent = results.expo.sent + results.fcm.sent;
      const totalFailed = results.expo.failed + results.fcm.failed;
      const totalSkipped = results.expo.skipped + results.fcm.skipped;
      
      console.log(
        `📊 Bulk push completed: Total - ${totalSent} sent, ${totalFailed} failed, ${totalSkipped} skipped`
      );
      console.log(
        `📊 Bulk push details: Expo - ${results.expo.sent} sent, ${results.expo.failed} failed, ${results.expo.skipped} skipped | FCM - ${results.fcm.sent} sent, ${results.fcm.failed} failed, ${results.fcm.skipped} skipped`
      );

      return results;
    } catch (error) {
      console.error("❌ Error sending bulk push notifications:", error.message);
      return { success: false, error: error.message };
    }
  }

  // בדיקת סטטוס של התראות שנשלחו (Expo only)
  async checkNotificationStatus(ticketIds) {
    try {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(ticketIds);

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
    return await this.sendPushNotification({
      to: user.pushToken,
      title: reminder.title,
      body: reminder.description || "זמן לתזכורת שלך!",
      type: "reminder",
      userId: user._id || user.id,
      data: {
        type: "reminder",
        reminderId: reminder._id.toString(),
        petId: reminder.petId.toString(),
      },
    });
  }

  // שליחת התראה לרשומה רפואית
  async sendMedicalRecordNotification(user, medicalRecord) {
    return await this.sendPushNotification({
      to: user.pushToken,
      title: medicalRecord.recordName || medicalRecord.title || "רשומה רפואית",
      body: medicalRecord.description || "רשומה רפואית חדשה",
      type: "medical",
      userId: user._id || user.id,
      data: {
        type: "medical",
        medicalRecordId: medicalRecord._id.toString(),
        petId: medicalRecord.petId.toString(),
      },
    });
  }

  // שליחת התראה להוצאה
  async sendExpenseNotification(user, expense) {
    return await this.sendPushNotification({
      to: user.pushToken,
      title: expense.description || "הוצאה חדשה",
      body: `סכום: ₪${expense.amount}`,
      type: "expense",
      userId: user._id || user.id,
      data: {
        type: "expense",
        expenseId: expense._id.toString(),
        petId: expense.petId.toString(),
      },
    });
  }
}

module.exports = new PushNotificationService();
