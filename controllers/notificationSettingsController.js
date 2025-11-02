const {
  getNotificationSettings,
  getNotificationSetting,
  updateNotificationSetting,
  initializeDefaultSettings,
} = require("../utils/notificationSettingsService");
const { notificationSettingsUpdate } = require("../models/NotificationSettingsModel");

/**
 * קבלת כל הגדרות ההתראות
 * GET /admin/notifications/settings
 */
const getAllNotificationSettings = async (req, res, next) => {
  try {
    const settings = await getNotificationSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error getting notification settings:", error);
    const dbError = new Error("Error getting notification settings");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * קבלת הגדרה ספציפית
 * GET /admin/notifications/settings/:type
 */
const getNotificationSettingByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    
    if (!type) {
      const error = new Error("Notification type is required");
      error.statusCode = 400;
      return next(error);
    }
    
    const setting = await getNotificationSetting(type);
    res.json({ success: true, setting });
  } catch (error) {
    console.error(`Error getting notification setting for type ${req.params.type}:`, error);
    const dbError = new Error("Error getting notification setting");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * עדכון הגדרה
 * PUT /admin/notifications/settings/:type
 */
const updateNotificationSettingByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    const updateData = req.body;
    const userId = req.user?._id || req.user?.id;
    
    if (!type) {
      const error = new Error("Notification type is required");
      error.statusCode = 400;
      return next(error);
    }
    
    // Validation
    const { error, value } = notificationSettingsUpdate.validate(updateData, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const validationError = new Error(error.details.map((d) => d.message).join(", "));
      validationError.statusCode = 400;
      return next(validationError);
    }
    
    const setting = await updateNotificationSetting(type, value, userId);
    res.json({ success: true, setting, message: "Notification setting updated successfully" });
  } catch (error) {
    console.error(`Error updating notification setting for type ${req.params.type}:`, error);
    const dbError = new Error("Error updating notification setting");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * הפעלה/ביטול מהיר
 * PUT /admin/notifications/settings/:type/toggle
 */
const toggleNotificationSetting = async (req, res, next) => {
  try {
    const { type } = req.params;
    const userId = req.user?._id || req.user?.id;
    
    if (!type) {
      const error = new Error("Notification type is required");
      error.statusCode = 400;
      return next(error);
    }
    
    const currentSetting = await getNotificationSetting(type);
    const newEnabledState = !currentSetting.isEnabled;
    
    const setting = await updateNotificationSetting(
      type,
      { isEnabled: newEnabledState },
      userId
    );
    
    res.json({
      success: true,
      setting,
      message: `Notification type ${type} ${newEnabledState ? "enabled" : "disabled"}`,
    });
  } catch (error) {
    console.error(`Error toggling notification setting for type ${req.params.type}:`, error);
    const dbError = new Error("Error toggling notification setting");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * אתחול הגדרות ברירת מחדל
 * POST /admin/notifications/settings/initialize
 */
const initializeSettings = async (req, res, next) => {
  try {
    await initializeDefaultSettings();
    res.json({
      success: true,
      message: "Default notification settings initialized",
    });
  } catch (error) {
    console.error("Error initializing notification settings:", error);
    const dbError = new Error("Error initializing notification settings");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

module.exports = {
  getAllNotificationSettings,
  getNotificationSettingByType,
  updateNotificationSettingByType,
  toggleNotificationSetting,
  initializeSettings,
};

