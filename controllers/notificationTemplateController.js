const {
  NotificationTemplate,
  notificationTemplateCreate,
  notificationTemplateUpdate,
} = require("../models/NotificationTemplateModel");
const { getNotificationSetting } = require("../utils/notificationSettingsService");
const pushService = require("../utils/pushNotificationService");
const logger = require("../utils/logger");

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
    logger.error(`Error getting notification templates: ${error.message}`, { error, stack: error.stack });
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
    logger.error(`Error getting notification template: ${error.message}`, { error, stack: error.stack, templateId: req.params.id });
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
    logger.error(`Error creating notification template: ${error.message}`, { error, stack: error.stack, templateData: req.body });
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
    logger.error(`Error updating notification template: ${error.message}`, { error, stack: error.stack, templateId: req.params.id });
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
    logger.error(`Error deleting notification template: ${error.message}`, { error, stack: error.stack, templateId: req.params.id });
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
    logger.error(`Error initializing notification templates: ${error.message}`, { error, stack: error.stack });
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
    logger.info("📋 Starting sendFromTemplate...");
    const { id } = req.params;
    const { variables = {}, targetAudience, userIds } = req.body;
    
    logger.info(`📋 Template ID: ${id}`);
    logger.info(`📋 Variables:`, JSON.stringify(variables));
    logger.info(`📋 Target audience: ${targetAudience}`);
    
    const template = await NotificationTemplate.findById(id);
    if (!template) {
      logger.error(`❌ Template not found: ${id}`);
      const error = new Error("Template not found");
      error.statusCode = 404;
      return next(error);
    }

    logger.info(`✅ Template found: ${template.name}`);

    if (!template.isActive) {
      logger.error(`❌ Template is not active: ${template.name}`);
      const error = new Error("Template is not active");
      error.statusCode = 400;
      return next(error);
    }

    logger.info(`✅ Template is active`);

    // Helper function to replace variables in text
    const replaceVariables = (text, vars) => {
      if (!text) return "";
      let result = text;
      template.variables?.forEach((variable) => {
        if (variable.key) {
          // Check if variable exists in vars, otherwise use defaultValue or empty string
          const value = vars[variable.key] !== undefined 
            ? (vars[variable.key] || "") 
            : (variable.defaultValue || "");
          const escapedKey = variable.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          result = result.replace(new RegExp(`\\{${escapedKey}\\}`, "g"), value);
        }
      });
      // Also replace any remaining variables that might be in userData but not in template.variables
      Object.keys(vars).forEach((key) => {
        if (vars[key] !== undefined && vars[key] !== null) {
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          result = result.replace(new RegExp(`\\{${escapedKey}\\}`, "g"), vars[key].toString());
        }
      });
      return result;
    };

    // Helper function to get user-specific data
    const getUserData = async (userId) => {
      const userData = { ...variables }; // Start with provided variables
      
      let userPets = [];
      
      try {
        // Ensure Pet and User are available
        const { Pet } = require("../models/petModel");
        const { User } = require("../models/userModel");
        
        // Get user's pets
        userPets = await Pet.find({ owner: userId }).lean();
        if (userPets.length > 0) {
          const firstPet = userPets[0];
          userData.petName = firstPet.name || "";
          userData.firstPetName = firstPet.name || "";
          
          // If multiple pets, create a list
          if (userPets.length > 1) {
            userData.petNames = userPets.map(p => p.name).join(", ");
          } else {
            userData.petNames = firstPet.name || "";
          }
        } else {
          userData.petName = "";
          userData.firstPetName = "";
          userData.petNames = "";
        }

        // Get last walk (for any pet of this user)
        try {
          const { Walk } = require("../models/walkModel");
          if (userPets && userPets.length > 0) {
            const userPetIds = userPets.map(p => p._id);
            const lastWalk = await Walk.findOne({ 
              petId: { $in: userPetIds } 
            }).sort({ endTime: -1 }).lean();
            if (lastWalk && lastWalk.endTime) {
              const daysSince = Math.floor((Date.now() - new Date(lastWalk.endTime).getTime()) / (1000 * 60 * 60 * 24));
              userData.lastWalkDays = daysSince.toString();
              userData.daysSinceLastWalk = daysSince.toString();
            } else {
              userData.lastWalkDays = "";
              userData.daysSinceLastWalk = "";
            }
          } else {
            userData.lastWalkDays = "";
            userData.daysSinceLastWalk = "";
          }
        } catch (error) {
          logger.error(`Error getting last walk for user ${userId}:`, error);
          userData.lastWalkDays = "";
          userData.daysSinceLastWalk = "";
        }

        // Get last expense
        const { Expense } = require("../models/ExpenseModel");
        const lastExpense = await Expense.findOne({ userId }).sort({ date: -1 }).lean();
        if (lastExpense) {
          userData.lastExpenseAmount = lastExpense.amount?.toString() || "";
          userData.lastExpense = lastExpense.amount?.toString() || "";
        } else {
          userData.lastExpenseAmount = "";
          userData.lastExpense = "";
        }

        // Get total expenses
        const totalExpensesResult = await Expense.aggregate([
          { $match: { userId: userId } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        if (totalExpensesResult.length > 0) {
          userData.totalExpenses = totalExpensesResult[0].total.toString();
        } else {
          userData.totalExpenses = "0";
        }

        // Get last medical record
        const { MedicalRecord } = require("../models/MedicalRecordModel");
        const lastMedical = await MedicalRecord.findOne({ userId }).sort({ date: -1 }).lean();
        if (lastMedical) {
          userData.lastMedicalRecord = lastMedical.recordName || "";
          if (lastMedical.date) {
            const daysSince = Math.floor((Date.now() - new Date(lastMedical.date).getTime()) / (1000 * 60 * 60 * 24));
            userData.lastMedicalDays = daysSince.toString();
            userData.daysSinceLastMedical = daysSince.toString();
          }
        } else {
          userData.lastMedicalRecord = "";
          userData.lastMedicalDays = "";
          userData.daysSinceLastMedical = "";
        }

        // Get user name (User is already defined above)
        const user = await User.findById(userId).lean();
        if (user) {
          userData.userName = user.name || "";
          userData.userName_heb = user.name || "";
        } else {
          userData.userName = "";
          userData.userName_heb = "";
        }
      } catch (error) {
        logger.error(`❌ Error getting user data for ${userId}:`, error);
        logger.error(`❌ Error stack:`, error.stack);
        // Continue with default values - set empty strings for missing data
        if (!userData.petName) userData.petName = "";
        if (!userData.firstPetName) userData.firstPetName = "";
        if (!userData.petNames) userData.petNames = "";
        if (!userData.lastWalkDays) userData.lastWalkDays = "";
        if (!userData.daysSinceLastWalk) userData.daysSinceLastWalk = "";
        if (!userData.lastExpenseAmount) userData.lastExpenseAmount = "";
        if (!userData.lastExpense) userData.lastExpense = "";
        if (!userData.totalExpenses) userData.totalExpenses = "0";
        if (!userData.lastMedicalRecord) userData.lastMedicalRecord = "";
        if (!userData.lastMedicalDays) userData.lastMedicalDays = "";
        if (!userData.daysSinceLastMedical) userData.daysSinceLastMedical = "";
        if (!userData.userName) userData.userName = "";
        if (!userData.userName_heb) userData.userName_heb = "";
      }

      // Apply default values for variables not set
      template.variables?.forEach((variable) => {
        if (variable.key && userData[variable.key] === undefined) {
          userData[variable.key] = variable.defaultValue || "";
        }
      });

      return userData;
    };

    // Use notification settings type if defined
    const notificationType = template.notificationSettingsType || template.type;

    // Build query based on target audience
    const { User } = require("../models/userModel");
    const { Pet } = require("../models/petModel");
    
    // Build query for ALL users (not just those with push tokens)
    // We'll send push to those with tokens, but save to DB for all
    let query = {};

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
        if (userIds && userIds.length > 0) {
          query._id = { $in: userIds };
        } else {
          // No specific users selected, return empty
          return res.json({
            success: true,
            totalUsers: 0,
            usersWithTokens: 0,
            sentCount: 0,
            failedCount: 0,
            savedToDbCount: 0,
            message: "לא נבחרו משתמשים ספציפיים",
          });
        }
        break;
      // "all" - default - query remains empty {}
    }

    // Find ALL users matching the query (not just those with push tokens)
    const users = await User.find(query, { pushToken: 1, _id: 1, pushNotificationsEnabled: 1 }).lean();

    if (users.length === 0) {
      return res.json({
        success: true,
        totalUsers: 0,
        usersWithTokens: 0,
        sentCount: 0,
        failedCount: 0,
        savedToDbCount: 0,
        message: "לא נמצאו משתמשים במערכת",
      });
    }

    // Filter only users with push tokens and notifications enabled for push sending
    const usersWithTokens = users.filter(
      (user) => user.pushToken && user.pushNotificationsEnabled !== false
    );

    const { Notification } = require("../models/NotificationModel");

    let sentCount = 0;
    let failedCount = 0;
    let savedToDbCount = 0;

    // Send push notifications to users with tokens (personalized for each user)
    if (usersWithTokens.length > 0) {
      logger.info(`📤 Sending personalized push notifications to ${usersWithTokens.length} users with tokens (template: "${template.name}")`);
      for (const user of usersWithTokens) {
        try {
          // Get user-specific data
          const userData = await getUserData(user._id || user.id);
          
          logger.info(`   User data:`, JSON.stringify(userData));
          logger.info(`   Template title: "${template.title}"`);
          logger.info(`   Template body: "${template.body}"`);
          
          // Replace variables with user-specific data
          const personalizedTitle = replaceVariables(template.title, userData);
          const personalizedBody = replaceVariables(template.body, userData);
          
          logger.info(`📱 Sending personalized notification to user ${user._id}:`);
          logger.info(`   Title: ${personalizedTitle}`);
          logger.info(`   Body: ${personalizedBody || "(empty)"}`);
          
          const result = await pushService.sendPushNotification({
            to: user.pushToken,
            title: personalizedTitle,
            body: personalizedBody,
            type: notificationType,
            userId: user._id || user.id,
            data: {
              type: notificationType,
              templateId: template._id.toString(),
              ...userData,
            },
          });
          if (result.success) {
            sentCount++;
            logger.info(`✅ Sent personalized push notification to user ${user._id}`);
          } else {
            failedCount++;
            logger.error(`❌ Failed to send to user ${user._id}:`, result.error || result.skipped);
          }
        } catch (error) {
          failedCount++;
          logger.error(`❌ Error sending to user ${user._id}:`, error.message);
          logger.error(`❌ Error details:`, error);
        }
      }
      logger.info(`📊 Push notifications result: ${sentCount} sent, ${failedCount} failed`);
    } else {
      logger.info(`⚠️ No users with push tokens found (${users.length} total users, but none have push tokens)`);
    }

    // Also save to DB for ALL users (even without push tokens) - personalized for each user
    // This allows users to see the notification when they open the app
    const allUserIds = users.map((u) => u._id);
    if (allUserIds.length > 0) {
      try {
        logger.info(`💾 Saving personalized notifications to DB for ${allUserIds.length} users...`);
        const notifications = [];
        
        for (const userId of allUserIds) {
          try {
            logger.info(`💾 Processing user ${userId} for DB save...`);
            // Get user-specific data
            const userData = await getUserData(userId);
            
            // Replace variables with user-specific data
            const personalizedTitle = replaceVariables(template.title, userData);
            const personalizedBody = replaceVariables(template.body, userData);
            
            logger.info(`   Title: ${personalizedTitle}`);
            logger.info(`   Body: ${personalizedBody || "(empty)"}`);
            
            // Only add if we have valid title and body
            if (personalizedTitle && personalizedBody) {
              notifications.push({
                userId,
                title: personalizedTitle,
                message: personalizedBody,
                type: notificationType,
                priority: template.priority || "medium",
                scheduledFor: new Date(),
                sound: "hayotush_notification",
                isRead: false,
              });
            } else {
              logger.warn(`⚠️ Skipping user ${userId} - empty title or body`);
            }
          } catch (error) {
            logger.error(`❌ Error getting user data for ${userId}:`, error);
            logger.error(`❌ Error stack:`, error.stack);
            // Continue with other users
          }
        }

        if (notifications.length > 0) {
          try {
            await Notification.insertMany(notifications);
            savedToDbCount = notifications.length;
            logger.info(`✅ Saved ${savedToDbCount} personalized notifications to DB for template "${template.name}"`);
          } catch (insertError) {
            logger.error("❌ Error inserting notifications to DB:", insertError);
            logger.error("❌ Error details:", insertError.message);
            logger.error("❌ Error stack:", insertError.stack);
            // Try to save individually to see which ones fail
            let individualSuccess = 0;
            for (const notif of notifications) {
              try {
                await Notification.create(notif);
                individualSuccess++;
              } catch (individualError) {
                logger.error(`❌ Failed to save notification for user ${notif.userId}:`, individualError.message);
              }
            }
            savedToDbCount = individualSuccess;
            logger.info(`⚠️ Saved ${individualSuccess} out of ${notifications.length} notifications individually`);
          }
        } else {
          logger.warn(`⚠️ No notifications to save (all had empty titles or bodies)`);
        }
      } catch (error) {
        logger.error("❌ Error saving notifications to DB:", error);
        logger.error("❌ Error stack:", error.stack);
        // Don't fail completely if DB save fails
        savedToDbCount = 0;
      }
    } else {
      logger.warn("⚠️ No users found to save notifications to DB");
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
        title: template.title,
        body: template.body,
      },
    });
  } catch (error) {
    logger.error("Error sending notification from template:", error);
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

