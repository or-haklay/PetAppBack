const {
  Reminder,
  reminderCreate,
  reminderUpdate,
  reminderListQuery,
} = require("../models/ReminderModel");
const { Notification } = require("../models/NotificationModel.js");

const GoogleCalendarService = require("../utils/googleCalendar");
const googleCalendar = new GoogleCalendarService();
const { registerEventInternal } = require("../utils/gamificationService");

const getAllReminders = async (req, res, next) => {
  try {
    const petIdFromParam = req.params.petId;
    const { error, value } = reminderListQuery.validate(
      { ...req.query, petId: req.query.petId || petIdFromParam },
      { abortEarly: false, stripUnknown: true, convert: true }
    );
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const { petId, onlyUpcoming, sort, order, limit } = value;

    const q = { userId: req.user._id };
    if (petId) q.petId = petId;
    if (onlyUpcoming) q.date = { $gte: new Date() };

    const sortField = sort || "date";
    const sortOrder = order === "desc" ? -1 : 1;

    let cursor = Reminder.find(q).sort({ [sortField]: sortOrder, _id: 1 });
    if (limit) cursor = cursor.limit(limit);

    const reminders = await cursor.lean();
    res.status(200).json({ reminders });
  } catch (err) {
    const e = new Error("An error occurred while fetching reminders.");
    e.statusCode = 500;
    next(e);
  }
};

const addReminder = async (req, res, next) => {
  try {
    if (req.params.petId && !req.body.petId) req.body.petId = req.params.petId;

    console.log("📅 Received reminder data:", {
      body: req.body,
      date: req.body.date,
      time: req.body.time,
      dateType: typeof req.body.date,
      timeType: typeof req.body.time,
    });

    const { error, value } = reminderCreate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    console.log("✅ Validated reminder data:", {
      validated: value,
      date: value.date,
      time: value.time,
    });

    const doc = await Reminder.create({ ...value, userId: req.user._id });

    console.log("💾 Created reminder document:", {
      id: doc._id,
      date: doc.date,
      time: doc.time,
      finalDate: doc.date,
    });

    // סנכרון עם גוגל יומן
    if (value.syncWithGoogle !== false && req.user.googleCalendarAccessToken) {
      try {
        const calendarResult = await googleCalendar.createCalendarEvent(
          req.user.googleCalendarAccessToken,
          doc
        );

        if (calendarResult.success) {
          doc.googleCalendarEventId = calendarResult.eventId;
          doc.googleCalendarEventLink = calendarResult.eventLink;
          await doc.save();
        }
      } catch (calendarError) {
        console.error("Google Calendar sync error:", calendarError);
        // לא נכשל אם גוגל לא עובד
      }
    }

    // Gamification: award once per day per reminder id
    let pointsAdded = 0;
    try {
      const result = await registerEventInternal(req.user._id, {
        eventKey: "ADD_REMINDER",
        targetId: String(doc._id),
      });
      pointsAdded = Number(result?.pointsAdded || 0);
    } catch (e) {
      console.error("[gamification] ADD_REMINDER failed:", e.message || e);
    }
    try {
      // יצירת התראה עם תאריך מתואם
      const notification = new Notification({
        userId: req.user._id,
        title: `תזכורת חדשה: ${doc.title}`,
        message: doc.description || "נוצרה תזכורת חדשה",
        type: "reminder",
        relatedId: doc._id,
        scheduledFor: doc.date, // התאריך המתואם מהמודל
        priority: "medium",
      });

      await notification.save();
      console.log("✅ Notification created for reminder:", {
        reminderId: doc._id,
        scheduledFor: doc.date,
        title: doc.title,
      });
    } catch (error) {
      console.error("❌ Error creating notification:", error);
      // לא נכשל אם ההתראה לא נוצרה, אבל נוסיף לוג מפורט
      console.error("Reminder created but notification failed:", {
        reminderId: doc._id,
        userId: req.user._id,
        error: error.message,
      });
    }
    res.status(201).json({
      message: "Reminder added successfully",
      reminder: doc,
      pointsAdded,
    });
  } catch (err) {
    const e = new Error("An error occurred while adding the reminder.");
    e.statusCode = 500;
    next(e);
  }
};

const updateReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;
    if (!reminderId) {
      const e = new Error("Reminder ID is required");
      e.statusCode = 400;
      return next(e);
    }

    const { error, value } = reminderUpdate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const updated = await Reminder.findOneAndUpdate(
      { _id: reminderId, userId: req.user._id },
      value,
      { new: true }
    );
    if (!updated) {
      const e = new Error("Reminder not found");
      e.statusCode = 404;
      return next(e);
    }

    // עדכון התראה קיימת
    try {
      await Notification.findOneAndUpdate(
        {
          userId: req.user._id,
          relatedId: reminderId,
          type: "reminder",
        },
        {
          title: `תזכורת מעודכנת: ${updated.title}`,
          message: updated.description || "תזכורת עודכנה",
          scheduledFor: updated.date,
          priority: "medium",
        }
      );
      console.log("✅ Notification updated for reminder:", reminderId);
    } catch (notificationError) {
      console.error("❌ Error updating notification:", notificationError);
    }

    // סנכרון עם גוגל יומן
    if (
      value.syncWithGoogle !== false &&
      req.user.googleCalendarAccessToken &&
      updated.googleCalendarEventId
    ) {
      try {
        const calendarResult = await googleCalendar.updateCalendarEvent(
          req.user.googleCalendarAccessToken,
          updated.googleCalendarEventId,
          updated
        );

        if (calendarResult.success) {
          updated.googleCalendarEventLink = calendarResult.eventLink;
          await updated.save();
        }
      } catch (calendarError) {
        console.error("Google Calendar update error:", calendarError);
        // לא נכשל אם גוגל לא עובד
      }
    }

    res
      .status(200)
      .json({ message: "Reminder updated successfully", reminder: updated });
  } catch (err) {
    const e = new Error("An error occurred while updating the reminder.");
    e.statusCode = 500;
    next(e);
  }
};

const deleteReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;
    const deleted = await Reminder.findOneAndDelete({
      _id: reminderId,
      userId: req.user._id,
    });
    if (!deleted) {
      const e = new Error("Reminder not found");
      e.statusCode = 404;
      return next(e);
    }

    // מחיקת התראה קשורה
    try {
      await Notification.findOneAndUpdate(
        {
          userId: req.user._id,
          relatedId: reminderId,
          type: "reminder",
        },
        { isDeleted: true }
      );
      console.log("✅ Notification deleted for reminder:", reminderId);
    } catch (notificationError) {
      console.error("❌ Error deleting notification:", notificationError);
    }

    // מחיקה מגוגל יומן
    if (req.user.googleCalendarAccessToken && deleted.googleCalendarEventId) {
      try {
        await googleCalendar.deleteCalendarEvent(
          req.user.googleCalendarAccessToken,
          deleted.googleCalendarEventId
        );
      } catch (calendarError) {
        console.error("Google Calendar delete error:", calendarError);
        // לא נכשל אם גוגל לא עובד
      }
    }

    res.status(200).json({ message: "Reminder deleted successfully" });
  } catch (err) {
    const e = new Error("An error occurred while deleting the reminder.");
    e.statusCode = 500;
    next(e);
  }
};

const completeReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;
    const { isCompleted = true } = req.body; // קבלת הפרמטר מה-body

    const updated = await Reminder.findOneAndUpdate(
      { _id: reminderId, userId: req.user._id },
      { isCompleted },
      { new: true }
    );
    if (!updated) {
      const e = new Error("Reminder not found");
      e.statusCode = 404;
      return next(e);
    }

    // אם התזכורת הושלמה ויש חזרה, ניצור תזכורת חדשה
    if (isCompleted && updated.repeatInterval !== "none") {
      try {
        let nextDate = new Date(updated.date);

        // חישוב התאריך הבא לפי סוג החזרה
        switch (updated.repeatInterval) {
          case "daily":
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case "yearly":
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        // יצירת תזכורת חדשה
        const newReminder = new Reminder({
          userId: updated.userId,
          petId: updated.petId,
          title: updated.title,
          description: updated.description,
          date: nextDate,
          time: updated.time,
          repeatInterval: updated.repeatInterval,
          timezone: updated.timezone,
          syncWithGoogle: updated.syncWithGoogle,
        });

        await newReminder.save();

        // יצירת התראה חדשה
        const notification = new Notification({
          userId: updated.userId,
          title: `תזכורת חוזרת: ${newReminder.title}`,
          message: newReminder.description || "נוצרה תזכורת חוזרת",
          type: "reminder",
          relatedId: newReminder._id,
          scheduledFor: newReminder.date,
          priority: "medium",
        });

        await notification.save();

        console.log("✅ Created recurring reminder:", {
          originalId: updated._id,
          newId: newReminder._id,
          nextDate: nextDate,
          repeatInterval: updated.repeatInterval,
        });
      } catch (repeatError) {
        console.error("❌ Error creating recurring reminder:", repeatError);
        // לא נכשל אם החזרה לא עבדה
      }
    }

    const message = isCompleted
      ? "Reminder marked as completed"
      : "Reminder marked as incomplete";

    res.status(200).json({ message, reminder: updated });
  } catch (err) {
    const e = new Error(
      "An error occurred while updating the reminder completion status."
    );
    e.statusCode = 500;
    next(e);
  }
};

module.exports = {
  getAllReminders,
  addReminder,
  updateReminder,
  deleteReminder,
  completeReminder,
};
