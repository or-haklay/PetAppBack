const { NotificationSettings } = require("../models/NotificationSettingsModel");
const { User } = require("../models/userModel");

/**
 * טוען את כל הגדרות ההתראות
 */
async function getNotificationSettings() {
  try {
    const settings = await NotificationSettings.find({}).sort({ type: 1 });
    return settings;
  } catch (error) {
    console.error("Error getting notification settings:", error);
    throw error;
  }
}

/**
 * טוען הגדרה ספציפית לפי סוג
 */
async function getNotificationSetting(type) {
  try {
    let setting = await NotificationSettings.findOne({ type });
    
    // אם אין הגדרה, ניצור אחת עם ברירת מחדל
    if (!setting) {
      setting = await createDefaultSetting(type);
    }
    
    return setting;
  } catch (error) {
    console.error(`Error getting notification setting for type ${type}:`, error);
    throw error;
  }
}

/**
 * יוצר הגדרה ברירת מחדל לפי סוג
 */
async function createDefaultSetting(type) {
  const defaultSettings = getDefaultSettings();
  const settingData = defaultSettings[type];
  
  if (!settingData) {
    throw new Error(`Unknown notification type: ${type}`);
  }
  
  const setting = new NotificationSettings({
    type,
    ...settingData,
  });
  
  await setting.save();
  return setting;
}

/**
 * מחזיר הגדרות ברירת מחדל לכל סוג התראה
 */
function getDefaultSettings() {
  return {
    reminder: {
      isEnabled: true,
      enabled: true,
      frequencyLimit: { maxPerHour: 4, maxPerDay: 20 },
      activeHours: { enabled: true, startHour: 8, endHour: 22 },
      titlePrefix: "תזכורת:",
      petNameInBody: true,
      petNameFormat: "עבור {petName}",
      priority: "high",
      sound: "hayotush_notification",
    },
    medical: {
      isEnabled: true,
      enabled: true,
      frequencyLimit: { maxPerHour: 2, maxPerDay: 10 },
      activeHours: { enabled: true, startHour: 8, endHour: 22 },
      titlePrefix: "רשומה רפואית:",
      petNameInBody: true,
      petNameFormat: "עבור {petName}",
      priority: "high",
      sound: "hayotush_notification",
    },
    expense: {
      isEnabled: true,
      enabled: true,
      frequencyLimit: { maxPerHour: 2, maxPerDay: 10 },
      activeHours: { enabled: false, startHour: 8, endHour: 22 },
      titlePrefix: "הוצאה חדשה:",
      petNameInBody: true,
      petNameFormat: "עבור {petName}",
      priority: "medium",
      sound: "hayotush_notification",
    },
    general: {
      isEnabled: true,
      enabled: true,
      frequencyLimit: { maxPerHour: 3, maxPerDay: 20 },
      activeHours: { enabled: false, startHour: 8, endHour: 22 },
      titlePrefix: "",
      petNameInBody: false,
      petNameFormat: "עבור {petName}",
      priority: "medium",
      sound: "hayotush_notification",
    },
    tip: {
      isEnabled: true,
      enabled: true,
      frequencyLimit: { maxPerHour: 1, maxPerDay: 3 },
      activeHours: { enabled: true, startHour: 8, endHour: 22 },
      titlePrefix: "טיפ יומי:",
      petNameInBody: false,
      petNameFormat: "עבור {petName}",
      priority: "low",
      sound: "hayotush_notification",
    },
    engagement: {
      isEnabled: true,
      enabled: true,
      frequencyLimit: { maxPerHour: 1, maxPerDay: 5 },
      activeHours: { enabled: true, startHour: 8, endHour: 22 },
      titlePrefix: "",
      petNameInBody: false,
      petNameFormat: "עבור {petName}",
      priority: "low",
      sound: "hayotush_notification",
    },
    walk: {
      isEnabled: true,
      enabled: true,
      frequencyLimit: { maxPerHour: 3, maxPerDay: 15 },
      activeHours: { enabled: false, startHour: 8, endHour: 22 },
      titlePrefix: "",
      petNameInBody: true,
      petNameFormat: "עבור {petName}",
      priority: "medium",
      sound: "hayotush_notification",
    },
  };
}

/**
 * מעדכן הגדרה
 */
async function updateNotificationSetting(type, settings, updatedBy) {
  try {
    let setting = await NotificationSettings.findOne({ type });
    
    if (!setting) {
      // אם אין הגדרה, ניצור אחת
      setting = new NotificationSettings({ type });
    }
    
    // עדכון השדות
    Object.keys(settings).forEach((key) => {
      if (settings[key] !== undefined) {
        setting[key] = settings[key];
      }
    });
    
    if (updatedBy) {
      setting.updatedBy = updatedBy;
    }
    
    // עדכון enabled/isEnabled יחד
    if (settings.isEnabled !== undefined) {
      setting.enabled = settings.isEnabled;
    }
    if (settings.enabled !== undefined) {
      setting.isEnabled = settings.enabled;
    }
    
    await setting.save();
    return setting;
  } catch (error) {
    console.error(`Error updating notification setting for type ${type}:`, error);
    throw error;
  }
}

/**
 * בודק אם סוג התראה מופעל
 */
async function isNotificationEnabled(type) {
  try {
    const setting = await getNotificationSetting(type);
    return setting.isEnabled || setting.enabled;
  } catch (error) {
    console.error(`Error checking if notification is enabled for type ${type}:`, error);
    // במקרה של שגיאה, נחזיר false (לא לשלוח)
    return false;
  }
}

/**
 * בודק תדירות ושעות לפני שליחה
 * מחזיר { canSend: boolean, reason?: string }
 */
async function canSendNotification(type, userId) {
  try {
    const setting = await getNotificationSetting(type);
    
    // בודק אם מופעל
    if (!setting.isEnabled && !setting.enabled) {
      return { canSend: false, reason: "Notification type is disabled" };
    }
    
    // בודק שעות פעילות
    if (setting.activeHours.enabled) {
      const now = new Date();
      const currentHour = now.getHours();
      
      if (currentHour < setting.activeHours.startHour || currentHour >= setting.activeHours.endHour) {
        return {
          canSend: false,
          reason: `Outside active hours (${setting.activeHours.startHour}:00 - ${setting.activeHours.endHour}:00)`,
        };
      }
    }
    
    // בודק תדירות
    const user = await User.findById(userId).select("notificationHistory");
    if (!user) {
      return { canSend: false, reason: "User not found" };
    }
    
    // אם אין היסטוריה, אפשר לשלוח
    if (!user.notificationHistory || !user.notificationHistory[type]) {
      return { canSend: true };
    }
    
    const history = user.notificationHistory[type];
    if (!Array.isArray(history) || history.length === 0) {
      return { canSend: true };
    }
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // ספירת התראות בשעה האחרונה
    const sentInLastHour = history.filter((timestamp) => {
      const ts = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return ts >= oneHourAgo;
    }).length;
    
    // ספירת התראות ב-24 השעות האחרונות
    const sentInLastDay = history.filter((timestamp) => {
      const ts = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return ts >= oneDayAgo;
    }).length;
    
    if (sentInLastHour >= setting.frequencyLimit.maxPerHour) {
      return {
        canSend: false,
        reason: `Frequency limit reached: ${sentInLastHour}/${setting.frequencyLimit.maxPerHour} per hour`,
      };
    }
    
    if (sentInLastDay >= setting.frequencyLimit.maxPerDay) {
      return {
        canSend: false,
        reason: `Frequency limit reached: ${sentInLastDay}/${setting.frequencyLimit.maxPerDay} per day`,
      };
    }
    
    return { canSend: true };
  } catch (error) {
    console.error(`Error checking if can send notification for type ${type}:`, error);
    // במקרה של שגיאה, נחזיר false (לא לשלוח)
    return { canSend: false, reason: error.message };
  }
}

/**
 * מאתחל את כל ההגדרות עם ברירת מחדל (אם אין)
 */
async function initializeDefaultSettings() {
  try {
    const defaultSettings = getDefaultSettings();
    const types = Object.keys(defaultSettings);
    
    for (const type of types) {
      const existing = await NotificationSettings.findOne({ type });
      if (!existing) {
        await createDefaultSetting(type);
        console.log(`✅ Created default settings for notification type: ${type}`);
      }
    }
    
    console.log("✅ Notification settings initialized");
  } catch (error) {
    console.error("Error initializing default notification settings:", error);
    throw error;
  }
}

module.exports = {
  getNotificationSettings,
  getNotificationSetting,
  updateNotificationSetting,
  isNotificationEnabled,
  canSendNotification,
  initializeDefaultSettings,
  getDefaultSettings,
};

