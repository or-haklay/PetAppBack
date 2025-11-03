const cron = require("node-cron");
const { TZ } = require("../timezone");
const automatedNotificationService = require("../automatedNotificationService");
const { AutomatedNotification } = require("../../models/AutomatedNotificationModel");

/**
 * בודקת את כל ההתראות הקבועות הפעילות
 * פונקציה זו נקראת על ידי ה-cron job
 */
async function checkAllAutomatedNotifications() {
  try {
    console.log(
      `[CRON] Starting automated notifications check at ${new Date().toISOString()}`
    );
    
    const result = await automatedNotificationService.checkAllAutomatedNotifications();
    
    console.log(
      `[CRON] Automated notifications check completed: ${result.checked} users checked, ${result.sent} notifications sent, ${result.errors} errors`
    );
    
    return result;
  } catch (error) {
    console.error("[CRON] Error in checkAllAutomatedNotifications:", error);
    return { checked: 0, sent: 0, errors: 1 };
  }
}

/**
 * מגדירה cron job שרץ כל שעה ובודק את כל ההתראות הקבועות הפעילות
 */
function scheduleAutomatedNotifications() {
  // רץ כל שעה (0 * * * *)
  cron.schedule("0 * * * *", checkAllAutomatedNotifications, { timezone: TZ });
  
  console.log("✅ Automated notifications scheduler started");
  console.log("   - Checking automated notifications: every hour (0 * * * *)");
}

/**
 * יוצרת התראות קבועות מובנות אם הן לא קיימות
 */
async function initializeDefaultAutomatedNotifications() {
  try {
    console.log("[AutomatedNotifications] Initializing default automated notifications...");

    const defaultNotifications = [
      {
        name: "תזכורת לטיול",
        type: "walk_reminder",
        enabled: true,
        checkFrequency: "0 * * * *", // כל שעה
        conditions: {
          daysSinceLastWalk: 3,
        },
        messageTemplate: {
          title: "🐾 תזכורת: זמן לטיול!",
          body: "{if:hasWalk}עברו כבר {daysSinceLastWalk} ימים מאז הטיול האחרון עם {petName}. אל תשכח לצאת לטיול!{else}עדיין לא תיעדת טיול עם {petName}! זה הזמן להתחיל - צא לטיול ותעד אותו באפליקציה.{/if}",
        },
        notificationSettings: {
          type: "walk",
          priority: "medium",
          sound: "hayotush_notification",
        },
      },
      {
        name: "תזכורת הוצאות",
        type: "expense_reminder",
        enabled: true,
        checkFrequency: "0 8 * * *", // כל יום ב-08:00
        conditions: {
          daysSinceLastExpense: 30,
        },
        messageTemplate: {
          title: "💸 תזכורת: עדכון הוצאות",
          body: "{if:hasExpense}עברו כבר {daysSinceLastExpense} ימים מאז ההוצאה האחרונה עבור {petName}. האם יש לך הוצאות חדשות?{else}עדיין לא תיעדת הוצאה עבור {petName}! זה הזמן להתחיל - תיעד את ההוצאות הראשונות שלך באפליקציה.{/if}",
        },
        notificationSettings: {
          type: "expense",
          priority: "low",
          sound: "hayotush_notification",
        },
      },
      {
        name: "תזכורת פעילות",
        type: "inactivity_reminder",
        enabled: true,
        checkFrequency: "0 9 * * *", // כל יום ב-09:00
        conditions: {
          daysSinceLastAppActivity: 2,
        },
        messageTemplate: {
          title: "💖 אנחנו מתגעגעים!",
          body: "לא נכנסת לאפליקציה כבר {daysSinceLastAppActivity} ימים. {petName} מחכה לך!",
        },
        notificationSettings: {
          type: "engagement",
          priority: "low",
          sound: "hayotush_notification",
        },
      },
      {
        name: "תזכורת רפואית - גורים",
        type: "medical_reminder",
        enabled: true,
        checkFrequency: "0 * * * *", // כל שעה
        conditions: {
          daysSinceLastMedicalRecord: 28, // 3-4 שבועות
          petAgeCategory: "puppy",
        },
        messageTemplate: {
          title: "🏥 תזכורת רפואית עבור {petName}",
          body: "עברו כבר {daysSinceLastMedicalRecord} ימים מאז הרשומה הרפואית האחרונה. גורים צריכים בדיקות כל 3-4 שבועות עד השלמת סדרת החיסונים.",
        },
        notificationSettings: {
          type: "medical",
          priority: "high",
          sound: "hayotush_notification",
        },
      },
      {
        name: "תזכורת רפואית - בוגרים",
        type: "medical_reminder",
        enabled: true,
        checkFrequency: "0 * * * *", // כל שעה
        conditions: {
          daysSinceLastMedicalRecord: 365, // פעם בשנה
          petAgeCategory: "adult",
        },
        messageTemplate: {
          title: "🏥 תזכורת רפואית עבור {petName}",
          body: "עברו כבר {daysSinceLastMedicalRecord} ימים מאז הרשומה הרפואית האחרונה. כלבים בוגרים צריכים בדיקה כללית פעם בשנה.",
        },
        notificationSettings: {
          type: "medical",
          priority: "high",
          sound: "hayotush_notification",
        },
      },
      {
        name: "תזכורת רפואית - מבוגרים",
        type: "medical_reminder",
        enabled: true,
        checkFrequency: "0 * * * *", // כל שעה
        conditions: {
          daysSinceLastMedicalRecord: 183, // כל חצי שנה
          petAgeCategory: "senior",
        },
        messageTemplate: {
          title: "🏥 תזכורת רפואית עבור {petName}",
          body: "עברו כבר {daysSinceLastMedicalRecord} ימים מאז הרשומה הרפואית האחרונה. כלבים מבוגרים צריכים בדיקה כל חצי שנה.",
        },
        notificationSettings: {
          type: "medical",
          priority: "high",
          sound: "hayotush_notification",
        },
      },
      {
        name: "סיכום חודשי הוצאות",
        type: "monthly_summary",
        enabled: true,
        checkFrequency: "0 8 1 * *", // יום ראשון של חודש ב-08:00 (שינוי ל-יום ראשון של חודש)
        conditions: {
          monthlyExpenseSummary: true,
        },
        messageTemplate: {
          title: "📊 סיכום חודשי עבור {petName}",
          body: "סיכום החודש שעבר: סכום כולל {monthlyTotal} ש\"ח. הקטגוריה הגבוהה ביותר: {topCategory}.",
        },
        notificationSettings: {
          type: "expense",
          priority: "low",
          sound: "hayotush_notification",
        },
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;

    for (const defaultNotif of defaultNotifications) {
      try {
        const existing = await AutomatedNotification.findOne({
          name: defaultNotif.name,
        });

        if (existing) {
          // עדכון אם קיים
          await AutomatedNotification.findOneAndUpdate(
            { name: defaultNotif.name },
            defaultNotif,
            { new: true }
          );
          updatedCount++;
          console.log(
            `[AutomatedNotifications] Updated default notification: ${defaultNotif.name}`
          );
        } else {
          // יצירה אם לא קיים
          const automatedNotif = new AutomatedNotification(defaultNotif);
          await automatedNotif.save();
          createdCount++;
          console.log(
            `[AutomatedNotifications] Created default notification: ${defaultNotif.name}`
          );
        }
      } catch (error) {
        console.error(
          `[AutomatedNotifications] Error initializing notification "${defaultNotif.name}":`,
          error
        );
      }
    }

    console.log(
      `[AutomatedNotifications] Default notifications initialized: ${createdCount} created, ${updatedCount} updated`
    );
  } catch (error) {
    console.error(
      "[AutomatedNotifications] Error initializing default notifications:",
      error
    );
  }
}

module.exports = {
  scheduleAutomatedNotifications,
  checkAllAutomatedNotifications,
  initializeDefaultAutomatedNotifications,
};

