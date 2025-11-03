const { AutomatedNotification } = require("../models/AutomatedNotificationModel");
const { User } = require("../models/userModel");
const { Pet } = require("../models/petModel");
const { Walk } = require("../models/walkModel");
const { Expense } = require("../models/ExpenseModel");
const { MedicalRecord } = require("../models/MedicalRecordModel");
const { Notification } = require("../models/NotificationModel");
const pushNotificationService = require("./pushNotificationService");

/**
 * מחשב קטגוריית גיל לפי תאריך לידה
 * @param {Date} birthDate - תאריך לידה
 * @returns {string} - "puppy", "adult", או "senior"
 */
function calculatePetAgeCategory(birthDate) {
  if (!birthDate) {
    return null;
  }

  const now = new Date();
  const birth = new Date(birthDate);
  const diffTime = Math.abs(now - birth);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Puppy: עד שנה (365 ימים)
  if (diffDays <= 365) {
    return "puppy";
  }
  // Adult: שנה עד 8 שנים (2920 ימים)
  if (diffDays <= 2920) {
    return "adult";
  }
  // Senior: מעל 8 שנים
  return "senior";
}

/**
 * בודק תנאים למשתמש/חיה ספציפיים
 * @param {string} userId - ID המשתמש
 * @param {string} petId - ID החיה (אופציונלי)
 * @param {Object} automatedNotif - אובייקט AutomatedNotification
 * @returns {Object} - { passed: boolean, reason?: string }
 */
async function checkConditions(userId, petId, automatedNotif) {
  const conditions = automatedNotif.conditions || {};

  // בדיקת ימים מאז טיול אחרון
  if (conditions.daysSinceLastWalk !== undefined) {
    let query = { userId };
    if (petId) {
      query.petId = petId;
    }
    const lastWalk = await Walk.findOne(query).sort({ endTime: -1 }).lean();
    if (lastWalk && lastWalk.endTime) {
      const daysAgo =
        (Date.now() - new Date(lastWalk.endTime).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysAgo < conditions.daysSinceLastWalk) {
        return {
          passed: false,
          reason: `Last walk was too recent (${Math.round(daysAgo)} days ago)`,
        };
      }
    } else if (conditions.daysSinceLastWalk > 0) {
      // אם אין טיולים בכלל, ואנחנו בודקים ימים מאז טיול, זה עובר (או לא - תלוי בלוגיקה)
      // כאן נניח שאם אין טיולים, אנחנו רוצים לשלוח התראה
      return { passed: true };
    }
  }

  // בדיקת ימים מאז הוצאה אחרונה
  if (conditions.daysSinceLastExpense !== undefined) {
    let query = { userId };
    if (petId) {
      query.petId = petId;
    }
    const lastExpense = await Expense.findOne(query).sort({ date: -1 }).lean();
    if (lastExpense && lastExpense.date) {
      const daysAgo =
        (Date.now() - new Date(lastExpense.date).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysAgo < conditions.daysSinceLastExpense) {
        return {
          passed: false,
          reason: `Last expense was too recent (${Math.round(daysAgo)} days ago)`,
        };
      }
    } else if (conditions.daysSinceLastExpense > 0) {
      // אם אין הוצאות בכלל, ואנחנו בודקים ימים מאז הוצאה, זה עובר
      return { passed: true };
    }
  }

  // בדיקת ימים מאז כניסה אחרונה לאפליקציה
  if (conditions.daysSinceLastAppActivity !== undefined) {
    const user = await User.findById(userId).lean();
    if (user && user.lastAppActivity) {
      const daysAgo =
        (Date.now() - new Date(user.lastAppActivity).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysAgo < conditions.daysSinceLastAppActivity) {
        return {
          passed: false,
          reason: `Last app activity was too recent (${Math.round(daysAgo)} days ago)`,
        };
      }
    } else if (conditions.daysSinceLastAppActivity > 0) {
      // אם אין פעילות בכלל, ואנחנו בודקים ימים מאז פעילות, זה עובר
      return { passed: true };
    }
  }

  // בדיקת ימים מאז רשומה רפואית אחרונה + קטגוריית גיל
  if (
    conditions.daysSinceLastMedicalRecord !== undefined &&
    conditions.petAgeCategory
  ) {
    if (!petId) {
      return {
        passed: false,
        reason: "Pet ID required for medical record check",
      };
    }

    const pet = await Pet.findById(petId).lean();
    if (!pet || !pet.birthDate) {
      return {
        passed: false,
        reason: "Pet birth date required for age category check",
      };
    }

    const ageCategory = calculatePetAgeCategory(pet.birthDate);
    if (ageCategory !== conditions.petAgeCategory) {
      return {
        passed: false,
        reason: `Pet age category mismatch (${ageCategory} vs ${conditions.petAgeCategory})`,
      };
    }

    const lastMedicalRecord = await MedicalRecord.findOne({
      userId,
      petId,
    })
      .sort({ date: -1 })
      .lean();

    if (lastMedicalRecord && lastMedicalRecord.date) {
      const daysAgo =
        (Date.now() - new Date(lastMedicalRecord.date).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysAgo < conditions.daysSinceLastMedicalRecord) {
        return {
          passed: false,
          reason: `Last medical record was too recent (${Math.round(
            daysAgo
          )} days ago)`,
        };
      }
    } else if (conditions.daysSinceLastMedicalRecord > 0) {
      // אם אין רשומות רפואיות בכלל, ואנחנו בודקים ימים מאז רשומה, זה עובר
      return { passed: true };
    }
  }

  // בדיקת סיכום חודשי
  if (conditions.monthlyExpenseSummary === true) {
    // זה ייבדק ב-getUserDataForNotification
    // כאן פשוט נחזיר שהתנאי עבר (הבדיקה עצמה תהיה בלוגיקה של שליחת ההתראה)
    return { passed: true };
  }

  return { passed: true };
}

/**
 * אוספת נתונים מותאמים אישית למשתמש/חיה
 * @param {string} userId - ID המשתמש
 * @param {string} petId - ID החיה (אופציונלי)
 * @param {string} type - סוג התראה קבועה
 * @returns {Object} - נתונים מותאמים אישית
 */
async function getUserDataForNotification(userId, petId, type) {
  const userData = {};

  // נתוני משתמש
  const user = await User.findById(userId).lean();
  if (user) {
    userData.userName = user.name || "";
    userData.userName_heb = user.name || "";
  }

  // נתוני חיות מחמד
  let pets = [];
  if (petId) {
    const pet = await Pet.findById(petId).lean();
    if (pet) {
      pets = [pet];
    }
  } else {
    pets = await Pet.find({ owner: userId }).lean();
  }

  if (pets.length > 0) {
    const firstPet = pets[0];
    userData.petName = firstPet.name || "";
    userData.firstPetName = firstPet.name || "";

    if (pets.length > 1) {
      userData.petNames = pets.map((p) => p.name).join(", ");
    } else {
      userData.petNames = firstPet.name || "";
    }

    // קטגוריית גיל
    if (firstPet.birthDate) {
      const ageCategory = calculatePetAgeCategory(firstPet.birthDate);
      userData.ageCategory = ageCategory === "puppy" ? "גור" : ageCategory === "adult" ? "בוגר" : "מבוגר";
    }

    // נתוני טיול אחרון
    const lastWalk = await Walk.findOne({
      userId,
      petId: firstPet._id,
    })
      .sort({ endTime: -1 })
      .lean();

    if (lastWalk && lastWalk.endTime) {
      const daysSince = Math.floor(
        (Date.now() - new Date(lastWalk.endTime).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      userData.lastWalkDays = daysSince.toString();
      userData.daysSinceLastWalk = daysSince.toString();
      userData.hasWalk = "true";
      userData.noWalk = "false";
    } else {
      // אין טיול תועד
      userData.lastWalkDays = "";
      userData.daysSinceLastWalk = "";
      userData.hasWalk = "false";
      userData.noWalk = "true";
    }
  } else {
    userData.petName = "";
    userData.firstPetName = "";
    userData.petNames = "";
    userData.ageCategory = "";
    userData.lastWalkDays = "";
    userData.daysSinceLastWalk = "";
    userData.hasWalk = "false";
    userData.noWalk = "true";
  }

  // נתוני הוצאות
  let expenseQuery = { userId };
  if (petId) {
    expenseQuery.petId = petId;
  }
  const lastExpense = await Expense.findOne(expenseQuery)
    .sort({ date: -1 })
    .lean();

  if (lastExpense) {
    userData.lastExpenseAmount = lastExpense.amount?.toString() || "";
    userData.lastExpense = lastExpense.amount?.toString() || "";
    if (lastExpense.date) {
      const daysSince = Math.floor(
        (Date.now() - new Date(lastExpense.date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      userData.lastExpenseDays = daysSince.toString();
      userData.daysSinceLastExpense = daysSince.toString();
    } else {
      userData.lastExpenseDays = "";
      userData.daysSinceLastExpense = "";
    }
    userData.hasExpense = "true";
    userData.noExpense = "false";
  } else {
    // אין הוצאה תועדת
    userData.lastExpenseAmount = "";
    userData.lastExpense = "";
    userData.lastExpenseDays = "";
    userData.daysSinceLastExpense = "";
    userData.hasExpense = "false";
    userData.noExpense = "true";
  }

  // סכום הוצאות כולל
  const totalExpensesResult = await Expense.aggregate([
    { $match: { userId } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  if (totalExpensesResult.length > 0) {
    userData.totalExpenses = totalExpensesResult[0].total.toString();
  } else {
    userData.totalExpenses = "0";
  }

  // נתוני רשומה רפואית אחרונה
  let medicalQuery = { userId };
  if (petId) {
    medicalQuery.petId = petId;
  }
  const lastMedical = await MedicalRecord.findOne(medicalQuery)
    .sort({ date: -1 })
    .lean();

  if (lastMedical) {
    userData.lastMedicalRecord = lastMedical.recordName || "";
    if (lastMedical.date) {
      const daysSince = Math.floor(
        (Date.now() - new Date(lastMedical.date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      userData.lastMedicalDays = daysSince.toString();
      userData.daysSinceLastMedical = daysSince.toString();
      userData.daysSinceLastMedicalRecord = daysSince.toString(); // Add alias for consistency
    } else {
      userData.lastMedicalDays = "";
      userData.daysSinceLastMedical = "";
      userData.daysSinceLastMedicalRecord = ""; // Add alias for consistency
    }
  } else {
    userData.lastMedicalRecord = "";
    userData.lastMedicalDays = "";
    userData.daysSinceLastMedical = "";
    userData.daysSinceLastMedicalRecord = ""; // Add alias for consistency
  }

  // נתוני פעילות אחרונה
  if (user && user.lastAppActivity) {
    const daysSince = Math.floor(
      (Date.now() - new Date(user.lastAppActivity).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    userData.lastAppActivityDays = daysSince.toString();
    userData.daysSinceLastAppActivity = daysSince.toString();
  } else {
    userData.lastAppActivityDays = "";
    userData.daysSinceLastAppActivity = "";
  }

  return userData;
}

/**
 * מחזירה סיכום הוצאות חודשי
 * @param {string} userId - ID המשתמש
 * @param {string} petId - ID החיה (אופציונלי)
 * @returns {Object} - { monthlyTotal, topCategory, categories }
 */
async function getMonthlyExpenseSummary(userId, petId) {
  const now = new Date();
  // סיכום של החודש שעבר (לא החודש הנוכחי)
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const firstDayOfLastMonth = new Date(lastMonthYear, lastMonth, 1);
  const lastDayOfLastMonth = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59);

  let query = {
    userId,
    date: {
      $gte: firstDayOfLastMonth,
      $lte: lastDayOfLastMonth,
    },
  };

  if (petId) {
    query.petId = petId;
  }

  const expenses = await Expense.find(query).lean();

  // חישוב סכום כולל
  const monthlyTotal = expenses.reduce(
    (sum, expense) => sum + (expense.amount || 0),
    0
  );

  // חישוב לפי קטגוריות
  const categories = {};
  expenses.forEach((expense) => {
    const category = expense.category || "Other";
    if (!categories[category]) {
      categories[category] = 0;
    }
    categories[category] += expense.amount || 0;
  });

  // מציאת הקטגוריה הגבוהה ביותר
  let topCategory = "";
  let topCategoryAmount = 0;
  Object.keys(categories).forEach((category) => {
    if (categories[category] > topCategoryAmount) {
      topCategoryAmount = categories[category];
      topCategory = category;
    }
  });

  // תרגום שם הקטגוריה לעברית
  const categoryTranslations = {
    "Vet": "וטרינר",
    "Food": "מזון",
    "Grooming": "טיפוח",
    "Toys": "צעצועים",
    "Insurance": "ביטוח",
    "Other": "אחר",
  };

  const topCategoryHebrew = categoryTranslations[topCategory] || topCategory;

  console.log(`[MonthlySummary] User ${userId}, Pet ${petId || "none"}: Total=${monthlyTotal}, TopCategory=${topCategory} (${topCategoryHebrew}), Amount=${topCategoryAmount}`);

  return {
    monthlyTotal: monthlyTotal.toString(),
    topCategory: topCategoryHebrew, // מחזיר את השם בעברית
    topCategoryEnglish: topCategory, // גם את השם באנגלית למקרה שצריך
    topCategoryAmount: topCategoryAmount.toString(),
    categories,
  };
}

/**
 * מחליפה משתנים בתבנית הודעה
 * @param {string} template - תבנית עם משתנים {variable} ותבניות מותנות {if:condition}...{else}...{/if}
 * @param {Object} data - נתונים להחלפה
 * @returns {string} - הודעה עם משתנים מוחלפים
 */
function replaceVariables(template, data) {
  if (!template) return "";
  let result = template;

  // תחילה נחליף תבניות מותנות {if:hasWalk}...{else}...{/if}
  // פורמט: {if:condition}תוכן אם true{else}תוכן אם false{/if}
  result = result.replace(
    /\{if:([^}]+)\}([^{]*?)(?:\{else\}([^{]*?))?\{\/if\}/g,
    (match, condition, trueContent, falseContent = "") => {
      const conditionValue = data[condition];
      // אם יש ערך "true" או כל ערך לא ריק (שלא "false"), נשתמש בתוכן ה-true
      if (conditionValue === "true" || (conditionValue !== "false" && conditionValue && conditionValue !== "")) {
        return trueContent;
      } else {
        return falseContent || "";
      }
    }
  );

  // עכשיו נחליף משתנים רגילים
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
      const value = data[key].toString();
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`\\{${escapedKey}\\}`, "g"), value);
    }
  });

  return result;
}

/**
 * שולחת התראה מותאמת אישית למשתמש
 * @param {string} userId - ID המשתמש
 * @param {Object} automatedNotif - אובייקט AutomatedNotification
 * @param {Object} userData - נתונים מותאמים אישית
 * @param {string} petId - ID החיה (אופציונלי)
 * @returns {Object} - { success: boolean, error?: string }
 */
async function sendAutomatedNotification(
  userId,
  automatedNotif,
  userData,
  petId = null
) {
  try {
    const user = await User.findById(userId).lean();
    if (!user || !user.pushNotificationsEnabled) {
      return {
        success: false,
        error: "User notifications disabled",
        skipped: true,
      };
    }

    // בדיקה אם כבר נשלחה התראה זו היום מאותו סוג התראה קבועה (למנוע כפילות)
    // נבדוק לפי automatedNotificationId אם קיים, או לפי תחילת הכותרת
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // נבדוק אם יש התראה שנשלחה היום מאותו סוג התראה קבועה
    // נשתמש בשם ההתראה הקבועה כדי לזהות כפילות
    const notificationNamePattern = automatedNotif.name
      .substring(0, 20)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex special chars
    
    const existingSimilar = await Notification.findOne({
      userId,
      // נבדוק לפי שם ההתראה הקבועה או לפי תחילת הכותרת
      $or: [
        { title: { $regex: notificationNamePattern, $options: "i" } },
        { message: { $regex: notificationNamePattern, $options: "i" } },
      ],
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    }).lean();

    if (existingSimilar) {
      console.log(
        `[AutomatedNotifications] Skipping duplicate notification "${automatedNotif.name}" for user ${userId} (already sent today at ${existingSimilar.createdAt})`
      );
      return {
        success: false,
        error: "Notification already sent today",
        skipped: true,
      };
    }

    // החלפת משתנים בתבנית
    const title = replaceVariables(
      automatedNotif.messageTemplate.title,
      userData
    );
    const body = replaceVariables(
      automatedNotif.messageTemplate.body,
      userData
    );

    console.log(`[AutomatedNotifications] Replaced variables - Title: "${title}", Body: "${body}"`);
    console.log(`[AutomatedNotifications] UserData:`, JSON.stringify(userData, null, 2));

    if (!title || !body) {
      return {
        success: false,
        error: "Empty title or body after variable replacement",
      };
    }

    // שליחת push notification
    if (user.pushToken) {
      const result = await pushNotificationService.sendPushNotification({
        to: user.pushToken,
        title,
        body,
        type: automatedNotif.notificationSettings.type || "general",
        userId,
        data: {
          type: automatedNotif.notificationSettings.type || "general",
          automatedNotificationId: automatedNotif._id.toString(),
          petId: petId ? petId.toString() : null,
        },
      });

      if (!result.success && !result.skipped) {
        return result;
      }
    }

    // שמירה ב-DB
    const notification = new Notification({
      userId,
      title,
      message: body,
      type: automatedNotif.notificationSettings.type || "general",
      scheduledFor: new Date(),
      priority: automatedNotif.notificationSettings.priority || "medium",
      sound: automatedNotif.notificationSettings.sound || "hayotush_notification",
    });

    await notification.save();

    return { success: true };
  } catch (error) {
    console.error(
      `Error sending automated notification to user ${userId}:`,
      error
    );
    return { success: false, error: error.message };
  }
}

/**
 * בודקת את כל ההתראות הקבועות הפעילות ושולחת התראות למשתמשים מתאימים
 * @returns {Object} - { checked: number, sent: number, errors: number }
 */
async function checkAllAutomatedNotifications() {
  try {
    console.log(
      `[AutomatedNotifications] Starting check at ${new Date().toISOString()}`
    );

    // טעינת כל ההתראות הקבועות הפעילות
    const automatedNotifications = await AutomatedNotification.find({
      enabled: true,
    }).lean();

    console.log(
      `[AutomatedNotifications] Found ${automatedNotifications.length} enabled automated notifications`
    );

    let totalChecked = 0;
    let totalSent = 0;
    let totalErrors = 0;

    for (const automatedNotif of automatedNotifications) {
      try {
        // בדיקה האם צריך לבדוק את ההתראה הזו (לפי checkFrequency)
        const now = new Date();
        const lastChecked = automatedNotif.lastChecked
          ? new Date(automatedNotif.lastChecked)
          : null;

        // TODO: כאן צריך לבדוק לפי cron expression אם הגיע הזמן לבדוק
        // כרגע נבדוק כל פעם (הלוגיקה המלאה תהיה ב-cron job)
        // נבדוק רק אם lastChecked לא קיים או שעבר מספיק זמן (למשל שעה)

        const cron = require("node-cron");
        const schedule = cron.validate(automatedNotif.checkFrequency);
        if (!schedule) {
          console.warn(
            `[AutomatedNotifications] Invalid cron expression for ${automatedNotif.name}: ${automatedNotif.checkFrequency}`
          );
          continue;
        }

        // כאן נבדוק אם צריך לבדוק את ההתראה הזו לפי ה-cron expression
        // פשוט נבדוק עכשיו (הלוגיקה המלאה תהיה ב-cron job)

        // טעינת כל המשתמשים
        const users = await User.find({
          pushNotificationsEnabled: { $ne: false },
        })
          .select("_id")
          .lean();

        console.log(
          `[AutomatedNotifications] Checking notification "${automatedNotif.name}" for ${users.length} users`
        );

        for (const user of users) {
          try {
            totalChecked++;

            // טעינת חיות המחמד של המשתמש (אם צריך)
            let pets = [];
            if (
              automatedNotif.conditions.daysSinceLastWalk !== undefined ||
              automatedNotif.conditions.daysSinceLastMedicalRecord !== undefined
            ) {
              pets = await Pet.find({ owner: user._id })
                .select("_id")
                .lean();
            }

            // אם יש חיות, נבדוק לכל חיה בנפרד
            if (pets.length > 0) {
              for (const pet of pets) {
                const conditionsCheck = await checkConditions(
                  user._id.toString(),
                  pet._id.toString(),
                  automatedNotif
                );

                if (conditionsCheck.passed) {
                  const userData = await getUserDataForNotification(
                    user._id.toString(),
                    pet._id.toString(),
                    automatedNotif.type
                  );

                  // אם זה סיכום חודשי, נקבל נתונים נוספים
                  if (automatedNotif.type === "monthly_summary") {
                    const summary = await getMonthlyExpenseSummary(
                      user._id.toString(),
                      pet._id.toString()
                    );
                    Object.assign(userData, summary);
                    userData.monthlyTotal = summary.monthlyTotal;
                    userData.topCategory = summary.topCategory;
                    userData.topCategoryAmount = summary.topCategoryAmount;
                    console.log(`[AutomatedNotifications] Monthly summary for user ${user._id}, pet ${pet._id}:`, summary);
                  }

                  const result = await sendAutomatedNotification(
                    user._id.toString(),
                    automatedNotif,
                    userData,
                    pet._id.toString()
                  );

                  if (result.success) {
                    totalSent++;
                    console.log(
                      `[AutomatedNotifications] Sent notification "${automatedNotif.name}" to user ${user._id} for pet ${pet._id}`
                    );
                  } else if (!result.skipped) {
                    totalErrors++;
                    console.error(
                      `[AutomatedNotifications] Failed to send notification "${automatedNotif.name}" to user ${user._id}:`,
                      result.error
                    );
                  }
                }
              }
            } else {
              // אם אין חיות, נבדוק רק לפי userId
              const conditionsCheck = await checkConditions(
                user._id.toString(),
                null,
                automatedNotif
              );

              if (conditionsCheck.passed) {
                const userData = await getUserDataForNotification(
                  user._id.toString(),
                  null,
                  automatedNotif.type
                );

                // אם זה סיכום חודשי, נקבל נתונים נוספים
                if (automatedNotif.type === "monthly_summary") {
                  const summary = await getMonthlyExpenseSummary(
                    user._id.toString(),
                    null
                  );
                  Object.assign(userData, summary);
                  userData.monthlyTotal = summary.monthlyTotal;
                  userData.topCategory = summary.topCategory;
                  userData.topCategoryAmount = summary.topCategoryAmount;
                  console.log(`[AutomatedNotifications] Monthly summary for user ${user._id}:`, summary);
                }

                const result = await sendAutomatedNotification(
                  user._id.toString(),
                  automatedNotif,
                  userData,
                  null
                );

                if (result.success) {
                  totalSent++;
                  console.log(
                    `[AutomatedNotifications] Sent notification "${automatedNotif.name}" to user ${user._id}`
                  );
                } else if (!result.skipped) {
                  totalErrors++;
                  console.error(
                    `[AutomatedNotifications] Failed to send notification "${automatedNotif.name}" to user ${user._id}:`,
                    result.error
                  );
                }
              }
            }
          } catch (error) {
            totalErrors++;
            console.error(
              `[AutomatedNotifications] Error processing user ${user._id} for notification "${automatedNotif.name}":`,
              error
            );
          }
        }

        // עדכון lastChecked
        await AutomatedNotification.findByIdAndUpdate(automatedNotif._id, {
          lastChecked: new Date(),
        });
      } catch (error) {
        totalErrors++;
        console.error(
          `[AutomatedNotifications] Error processing notification "${automatedNotif.name}":`,
          error
        );
      }
    }

    console.log(
      `[AutomatedNotifications] Check completed: ${totalChecked} users checked, ${totalSent} notifications sent, ${totalErrors} errors`
    );

    return {
      checked: totalChecked,
      sent: totalSent,
      errors: totalErrors,
    };
  } catch (error) {
    console.error("[AutomatedNotifications] Error in checkAllAutomatedNotifications:", error);
    return { checked: 0, sent: 0, errors: 1 };
  }
}

/**
 * בודקת התראה קבועה אחת בלבד (לבדיקה ידנית)
 * @param {string} automatedNotificationId - ID של ההתראה הקבועה
 * @returns {Object} - { checked: number, sent: number, errors: number }
 */
async function checkSingleAutomatedNotification(automatedNotificationId) {
  try {
    console.log(
      `[AutomatedNotifications] Starting check for single notification ${automatedNotificationId} at ${new Date().toISOString()}`
    );

    const automatedNotif = await AutomatedNotification.findById(automatedNotificationId).lean();

    if (!automatedNotif) {
      return { checked: 0, sent: 0, errors: 1, error: "Automated notification not found" };
    }

    if (!automatedNotif.enabled) {
      return { checked: 0, sent: 0, errors: 0, error: "Automated notification is disabled" };
    }

    // טעינת משתמשים מוגבלת (רק עד 100 למניעת timeout)
    const users = await User.find({
      pushNotificationsEnabled: { $ne: false },
    })
      .select("_id")
      .limit(100)
      .lean();

    console.log(
      `[AutomatedNotifications] Checking notification "${automatedNotif.name}" for ${users.length} users (limited to 100 for manual check)`
    );

    let totalChecked = 0;
    let totalSent = 0;
    let totalErrors = 0;

    for (const user of users) {
      try {
        totalChecked++;

        // טעינת חיות המחמד של המשתמש (אם צריך)
        let pets = [];
        if (
          automatedNotif.conditions.daysSinceLastWalk !== undefined ||
          automatedNotif.conditions.daysSinceLastMedicalRecord !== undefined
        ) {
          pets = await Pet.find({ owner: user._id })
            .select("_id")
            .lean();
        }

        // אם יש חיות, נבדוק לכל חיה בנפרד
        if (pets.length > 0) {
          for (const pet of pets) {
            const conditionsCheck = await checkConditions(
              user._id.toString(),
              pet._id.toString(),
              automatedNotif
            );

            if (conditionsCheck.passed) {
              const userData = await getUserDataForNotification(
                user._id.toString(),
                pet._id.toString(),
                automatedNotif.type
              );

              // אם זה סיכום חודשי, נקבל נתונים נוספים
              if (automatedNotif.type === "monthly_summary") {
                const summary = await getMonthlyExpenseSummary(
                  user._id.toString(),
                  pet._id.toString()
                );
                Object.assign(userData, summary);
                userData.monthlyTotal = summary.monthlyTotal;
                userData.topCategory = summary.topCategory;
                userData.topCategoryAmount = summary.topCategoryAmount;
                console.log(`[AutomatedNotifications] Monthly summary for user ${user._id}:`, summary);
              }

              const result = await sendAutomatedNotification(
                user._id.toString(),
                automatedNotif,
                userData,
                pet._id.toString()
              );

              if (result.success) {
                totalSent++;
              } else if (!result.skipped) {
                totalErrors++;
              }
            }
          }
        } else {
          // אם אין חיות, נבדוק רק לפי userId
          const conditionsCheck = await checkConditions(
            user._id.toString(),
            null,
            automatedNotif
          );

          if (conditionsCheck.passed) {
            const userData = await getUserDataForNotification(
              user._id.toString(),
              null,
              automatedNotif.type
            );

            // אם זה סיכום חודשי, נקבל נתונים נוספים
            if (automatedNotif.type === "monthly_summary") {
              const summary = await getMonthlyExpenseSummary(
                user._id.toString(),
                null
              );
              Object.assign(userData, summary);
              userData.monthlyTotal = summary.monthlyTotal;
              userData.topCategory = summary.topCategory;
              userData.topCategoryAmount = summary.topCategoryAmount;
              console.log(`[AutomatedNotifications] Monthly summary for user ${user._id}:`, summary);
            }

            const result = await sendAutomatedNotification(
              user._id.toString(),
              automatedNotif,
              userData,
              null
            );

            if (result.success) {
              totalSent++;
            } else if (!result.skipped) {
              totalErrors++;
            }
          }
        }
      } catch (error) {
        totalErrors++;
        console.error(
          `[AutomatedNotifications] Error processing user ${user._id}:`,
          error
        );
      }
    }

    // עדכון lastChecked
    await AutomatedNotification.findByIdAndUpdate(automatedNotificationId, {
      lastChecked: new Date(),
    });

    console.log(
      `[AutomatedNotifications] Single notification check completed: ${totalChecked} users checked, ${totalSent} notifications sent, ${totalErrors} errors`
    );

    return {
      checked: totalChecked,
      sent: totalSent,
      errors: totalErrors,
    };
  } catch (error) {
    console.error("[AutomatedNotifications] Error in checkSingleAutomatedNotification:", error);
    return { checked: 0, sent: 0, errors: 1, error: error.message };
  }
}

module.exports = {
  checkAllAutomatedNotifications,
  checkSingleAutomatedNotification,
  checkConditions,
  calculatePetAgeCategory,
  getUserDataForNotification,
  sendAutomatedNotification,
  getMonthlyExpenseSummary,
  replaceVariables,
};

