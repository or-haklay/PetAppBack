const {
  NotificationTemplate,
  notificationTemplateCreate,
  notificationTemplateUpdate,
} = require("../models/NotificationTemplateModel");
const { getNotificationSetting } = require("../utils/notificationSettingsService");
const pushService = require("../utils/pushNotificationService");

/**
 * קבלת כל התבניות
 * GET /admin/notifications/templates
 */
const getAllTemplates = async (req, res, next) => {
  try {
    const { type, isActive } = req.query;
    
    const query = {};
    if (type && type !== "all") {
      query.type = type;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const templates = await NotificationTemplate.find(query)
      .sort({ isBuiltIn: -1, createdAt: -1 })
      .lean();
    
    res.json({ success: true, templates });
  } catch (error) {
    console.error("Error getting notification templates:", error);
    const dbError = new Error("Error getting notification templates");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * קבלת תבנית ספציפית
 * GET /admin/notifications/templates/:id
 */
const getTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const template = await NotificationTemplate.findById(id);
    if (!template) {
      const error = new Error("Template not found");
      error.statusCode = 404;
      return next(error);
    }
    
    res.json({ success: true, template });
  } catch (error) {
    console.error("Error getting notification template:", error);
    const dbError = new Error("Error getting notification template");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * יצירת תבנית חדשה
 * POST /admin/notifications/templates
 */
const createTemplate = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    
    const { error, value } = notificationTemplateCreate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const validationError = new Error(error.details.map((d) => d.message).join(", "));
      validationError.statusCode = 400;
      return next(validationError);
    }
    
    const template = new NotificationTemplate({
      ...value,
      createdBy: userId,
      updatedBy: userId,
    });
    
    await template.save();
    res.status(201).json({ success: true, template });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const duplicateError = new Error("Template with this name already exists");
      duplicateError.statusCode = 400;
      return next(duplicateError);
    }
    console.error("Error creating notification template:", error);
    const dbError = new Error("Error creating notification template");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * עדכון תבנית
 * PUT /admin/notifications/templates/:id
 */
const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id;
    
    const template = await NotificationTemplate.findById(id);
    if (!template) {
      const error = new Error("Template not found");
      error.statusCode = 404;
      return next(error);
    }
    
    // לא ניתן לערוך תבניות מובנות (אבל ניתן לשלוח)
    // אם צריך, אפשר להסיר את זה
    // if (template.isBuiltIn) {
    //   const error = new Error("Cannot edit built-in templates");
    //   error.statusCode = 403;
    //   return next(error);
    // }
    
    const { error, value } = notificationTemplateUpdate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const validationError = new Error(error.details.map((d) => d.message).join(", "));
      validationError.statusCode = 400;
      return next(validationError);
    }
    
    Object.keys(value).forEach((key) => {
      template[key] = value[key];
    });
    template.updatedBy = userId;
    
    await template.save();
    res.json({ success: true, template });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateError = new Error("Template with this name already exists");
      duplicateError.statusCode = 400;
      return next(duplicateError);
    }
    console.error("Error updating notification template:", error);
    const dbError = new Error("Error updating notification template");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * מחיקת תבנית
 * DELETE /admin/notifications/templates/:id
 */
const deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const template = await NotificationTemplate.findById(id);
    if (!template) {
      const error = new Error("Template not found");
      error.statusCode = 404;
      return next(error);
    }
    
    // לא ניתן למחוק תבניות מובנות
    if (template.isBuiltIn) {
      const error = new Error("Cannot delete built-in templates");
      error.statusCode = 403;
      return next(error);
    }
    
    await NotificationTemplate.findByIdAndDelete(id);
    res.json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification template:", error);
    const dbError = new Error("Error deleting notification template");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * אתחול תבניות מובנות
 * POST /admin/notifications/templates/initialize
 */
const initializeTemplates = async (req, res, next) => {
  try {
    const builtInTemplates = [
      {
        name: "תזכורת לטיול",
        type: "walk",
        title: "זמן לטיול!",
        body: "עברו יותר מ-{days} ימים מאז הטיול האחרון עם {petName}",
        description: "תזכורת למשתמשים שלא יצאו לטיול זמן רב",
        isActive: true,
        isBuiltIn: true,
        variables: [
          { key: "days", label: "מספר ימים", defaultValue: "2" },
          { key: "petName", label: "שם החיה", defaultValue: "" },
        ],
        notificationSettingsType: "walk",
      },
      {
        name: "תזכורת חיסון",
        type: "reminder",
        title: "תזכורת חיסון",
        body: "זמן לחיסון {vaccineType} עבור {petName}",
        description: "תזכורת לחיסון שנתי או חיסון אחר",
        isActive: true,
        isBuiltIn: true,
        variables: [
          { key: "vaccineType", label: "סוג חיסון", defaultValue: "שנתי" },
          { key: "petName", label: "שם החיה", defaultValue: "" },
        ],
        notificationSettingsType: "reminder",
      },
      {
        name: "תזכורת בדיקה רפואית",
        type: "medical",
        title: "תזכורת בדיקה",
        body: "זמן לבדיקה רפואית עבור {petName}",
        description: "תזכורת לבדיקה רפואית שנתית או אחרת",
        isActive: true,
        isBuiltIn: true,
        variables: [
          { key: "petName", label: "שם החיה", defaultValue: "" },
        ],
        notificationSettingsType: "medical",
      },
      {
        name: "תזכורת הוצאה גבוהה",
        type: "expense",
        title: "תשומת לב: הוצאה גבוהה",
        body: "ההוצאה האחרונה של {amount}₪ עבור {petName} היא גבוהה מהממוצע",
        description: "התראה על הוצאה חריגה מהממוצע",
        isActive: true,
        isBuiltIn: true,
        variables: [
          { key: "amount", label: "סכום", defaultValue: "" },
          { key: "petName", label: "שם החיה", defaultValue: "" },
        ],
        notificationSettingsType: "expense",
      },
      {
        name: "תזכורת פעילות",
        type: "engagement",
        title: "תזכורת פעילות",
        body: "לא פתחת את האפליקציה זמן רב! {petName} מחכה לך",
        description: "תזכורת למשתמשים לא פעילים",
        isActive: true,
        isBuiltIn: true,
        variables: [
          { key: "petName", label: "שם החיה", defaultValue: "" },
        ],
        notificationSettingsType: "engagement",
      },
      {
        name: "טיפ יומי",
        type: "tip",
        title: "💡 טיפ יומי",
        body: "{tipContent}",
        description: "טיפ יומי למשתמשים",
        isActive: true,
        isBuiltIn: true,
        variables: [
          { key: "tipContent", label: "תוכן הטיפ", defaultValue: "" },
        ],
        notificationSettingsType: "tip",
      },
    ];

    let created = 0;
    let existing = 0;

    for (const templateData of builtInTemplates) {
      const existingTemplate = await NotificationTemplate.findOne({
        name: templateData.name,
      });

      if (!existingTemplate) {
        await NotificationTemplate.create(templateData);
        created++;
      } else {
        existing++;
      }
    }

    res.json({
      success: true,
      message: `Initialized templates: ${created} created, ${existing} already existed`,
      created,
      existing,
    });
  } catch (error) {
    console.error("Error initializing notification templates:", error);
    const dbError = new Error("Error initializing notification templates");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

/**
 * שליחת התראה מתבנית
 * POST /admin/notifications/templates/:id/send
 */
const sendFromTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { variables = {}, targetAudience, userIds } = req.body;
    
    const template = await NotificationTemplate.findById(id);
    if (!template) {
      const error = new Error("Template not found");
      error.statusCode = 404;
      return next(error);
    }

    if (!template.isActive) {
      const error = new Error("Template is not active");
      error.statusCode = 400;
      return next(error);
    }

    // Replace variables in title and body
    let finalTitle = template.title;
    let finalBody = template.body;

    // Replace variables
    template.variables?.forEach((variable) => {
      const value = variables[variable.key] || variable.defaultValue || "";
      finalTitle = finalTitle.replace(new RegExp(`\\{${variable.key}\\}`, "g"), value);
      finalBody = finalBody.replace(new RegExp(`\\{${variable.key}\\}`, "g"), value);
    });

    // Use notification settings type if defined
    const notificationType = template.notificationSettingsType || template.type;

    // Build query based on target audience
    const { User } = require("../models/userModel");
    const { Pet } = require("../models/petModel");
    
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
      // "all" - default
    }

    const users = await User.find(query, { pushToken: 1, _id: 1, pushNotificationsEnabled: 1 }).lean();

    // Filter only users with push tokens and notifications enabled
    const usersWithTokens = users.filter(
      (user) => user.pushToken && user.pushNotificationsEnabled !== false
    );

    const { Notification } = require("../models/NotificationModel");

    let sentCount = 0;
    let failedCount = 0;
    let savedToDbCount = 0;

    // Send push notifications to users with tokens
    if (usersWithTokens.length > 0) {
      for (const user of usersWithTokens) {
        try {
          const result = await pushService.sendPushNotification({
            to: user.pushToken,
            title: finalTitle,
            body: finalBody,
            type: notificationType,
            userId: user._id || user.id,
            data: {
              type: notificationType,
              templateId: template._id.toString(),
              ...variables,
            },
          });
          if (result.success) {
            sentCount++;
          } else {
            failedCount++;
            console.error(`Failed to send to user ${user._id}:`, result.error || result.skipped);
          }
        } catch (error) {
          failedCount++;
          console.error(`Failed to send to user ${user._id}:`, error.message);
        }
      }
    }

    // Also save to DB for all users (even without push tokens)
    // This allows users to see the notification when they open the app
    const allUserIds = users.map((u) => u._id);
    if (allUserIds.length > 0) {
      try {
        const notifications = allUserIds.map((userId) => ({
          userId,
          title: finalTitle,
          message: finalBody,
          type: notificationType,
          priority: template.priority || "medium",
          scheduledFor: new Date(),
          sound: "hayotush_notification",
          isRead: false,
        }));

        await Notification.insertMany(notifications);
        savedToDbCount = notifications.length;
      } catch (error) {
        console.error("Error saving notifications to DB:", error);
      }
    }

    // Return success even if no push tokens (we saved to DB)
    res.json({
      success: true,
      totalUsers: users.length,
      usersWithTokens: usersWithTokens.length,
      sentCount,
      failedCount,
      savedToDbCount,
      message: usersWithTokens.length === 0
        ? "לא נמצאו משתמשים עם push tokens מופעלים, אבל ההתראות נשמרו ב-DB"
        : `נשלחו ${sentCount} התראות push ו-${savedToDbCount} נשמרו ב-DB`,
      template: {
        name: template.name,
        title: finalTitle,
        body: finalBody,
      },
    });
  } catch (error) {
    console.error("Error sending notification from template:", error);
    const dbError = new Error("Error sending notification from template");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  initializeTemplates,
  sendFromTemplate,
};

