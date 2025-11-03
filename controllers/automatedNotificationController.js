const {
  AutomatedNotification,
  automatedNotificationCreate,
  automatedNotificationUpdate,
} = require("../models/AutomatedNotificationModel");
const automatedNotificationService = require("../utils/automatedNotificationService");
const logger = require("../utils/logger");

/**
 * קבלת כל ההתראות הקבועות
 * GET /api/admin/notifications/automated
 */
const getAllAutomatedNotifications = async (req, res, next) => {
  try {
    const automatedNotifications = await AutomatedNotification.find({})
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      automatedNotifications,
      count: automatedNotifications.length,
    });
  } catch (error) {
    logger.error(`Error getting automated notifications: ${error.message}`, { error, stack: error.stack });
    const dbError = new Error("Error getting automated notifications");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * קבלת התראה קבועה ספציפית
 * GET /api/admin/notifications/automated/:id
 */
const getAutomatedNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const automatedNotification = await AutomatedNotification.findById(id).lean();

    if (!automatedNotification) {
      const error = new Error("Automated notification not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      success: true,
      automatedNotification,
    });
  } catch (error) {
    logger.error(`Error getting automated notification: ${error.message}`, { error, stack: error.stack, notificationId: req.params.id });
    const dbError = new Error("Error getting automated notification");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * יצירת התראה קבועה חדשה
 * POST /api/admin/notifications/automated
 */
const createAutomatedNotification = async (req, res, next) => {
  try {
    const { error, value } = automatedNotificationCreate.validate(req.body);
    if (error) {
      const validationError = new Error(
        error.details.map((d) => d.message).join(", ")
      );
      validationError.statusCode = 400;
      return next(validationError);
    }

    const automatedNotification = new AutomatedNotification({
      ...value,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await automatedNotification.save();

    res.status(201).json({
      success: true,
      automatedNotification,
      message: "Automated notification created successfully",
    });
  } catch (error) {
    logger.error(`Error creating automated notification: ${error.message}`, { error, stack: error.stack, notificationData: req.body });
    if (error.code === 11000) {
      const duplicateError = new Error(
        "Automated notification with this name already exists"
      );
      duplicateError.statusCode = 400;
      return next(duplicateError);
    }
    const dbError = new Error("Error creating automated notification");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * עדכון התראה קבועה
 * PUT /api/admin/notifications/automated/:id
 */
const updateAutomatedNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = automatedNotificationUpdate.validate(req.body);

    if (error) {
      const validationError = new Error(
        error.details.map((d) => d.message).join(", ")
      );
      validationError.statusCode = 400;
      return next(validationError);
    }

    const automatedNotification = await AutomatedNotification.findByIdAndUpdate(
      id,
      {
        ...value,
        updatedBy: req.user._id,
      },
      { new: true, runValidators: true }
    );

    if (!automatedNotification) {
      const error = new Error("Automated notification not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      success: true,
      automatedNotification,
      message: "Automated notification updated successfully",
    });
  } catch (error) {
    logger.error(`Error updating automated notification: ${error.message}`, { error, stack: error.stack, notificationId: req.params.id });
    if (error.code === 11000) {
      const duplicateError = new Error(
        "Automated notification with this name already exists"
      );
      duplicateError.statusCode = 400;
      return next(duplicateError);
    }
    const dbError = new Error("Error updating automated notification");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * מחיקת התראה קבועה
 * DELETE /api/admin/notifications/automated/:id
 */
const deleteAutomatedNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const automatedNotification = await AutomatedNotification.findByIdAndDelete(
      id
    );

    if (!automatedNotification) {
      const error = new Error("Automated notification not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      success: true,
      message: "Automated notification deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting automated notification: ${error.message}`, { error, stack: error.stack, notificationId: req.params.id });
    const dbError = new Error("Error deleting automated notification");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * הפעלה/ביטול התראה קבועה
 * POST /api/admin/notifications/automated/:id/toggle
 */
const toggleAutomatedNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const automatedNotification = await AutomatedNotification.findById(id);

    if (!automatedNotification) {
      const error = new Error("Automated notification not found");
      error.statusCode = 404;
      return next(error);
    }

    automatedNotification.enabled = !automatedNotification.enabled;
    automatedNotification.updatedBy = req.user._id;
    await automatedNotification.save();

    res.json({
      success: true,
      automatedNotification,
      message: `Automated notification ${automatedNotification.enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (error) {
    logger.error(`Error toggling automated notification: ${error.message}`, { error, stack: error.stack, notificationId: req.params.id });
    const dbError = new Error("Error toggling automated notification");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * בדיקה ידנית של התראה קבועה (לבדיקות)
 * POST /api/admin/notifications/automated/:id/check
 */
const checkAutomatedNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const automatedNotification = await AutomatedNotification.findById(id).lean();

    if (!automatedNotification) {
      const error = new Error("Automated notification not found");
      error.statusCode = 404;
      return next(error);
    }

    if (!automatedNotification.enabled) {
      const error = new Error("Automated notification is disabled");
      error.statusCode = 400;
      return next(error);
    }

    // בדיקה רק של ההתראה הספציפית (לא כל ההתראות)
    const result = await automatedNotificationService.checkSingleAutomatedNotification(id);

    res.json({
      success: true,
      result,
      message: "Automated notification check completed",
    });
  } catch (error) {
    logger.error(`Error checking automated notification: ${error.message}`, { error, stack: error.stack, notificationId: req.params.id });
    const dbError = new Error("Error checking automated notification");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

module.exports = {
  getAllAutomatedNotifications,
  getAutomatedNotificationById,
  createAutomatedNotification,
  updateAutomatedNotification,
  deleteAutomatedNotification,
  toggleAutomatedNotification,
  checkAutomatedNotification,
};

