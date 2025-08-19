const {
  Reminder,
  reminderCreate,
  reminderUpdate,
  reminderListQuery,
} = require("../models/ReminderModel");
const { Notification } = require("../models/NotificationModel.js");

const GoogleCalendarService = require("../utils/googleCalendar");
const googleCalendar = new GoogleCalendarService();

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
      timeType: typeof req.body.time
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
      time: value.time
    });

    const doc = await Reminder.create({ ...value, userId: req.user._id });

    console.log("💾 Created reminder document:", {
      id: doc._id,
      date: doc.date,
      time: doc.time,
      finalDate: doc.date
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
    try {
      const notification = new Notification({
        userId: req.user._id,
        title: `תזכורת חדשה: ${doc.title}`,
        message: doc.description || "נוצרה תזכורת חדשה",
        type: "reminder",
        relatedId: doc._id,
        scheduledFor: doc.date,
        priority: "medium",
      });

      await notification.save();
      console.log("Notification created for reminder");
    } catch (error) {
      console.error("Error creating notification:", error);
      // לא נכשל אם ההתראה לא נוצרה
    }
    res
      .status(201)
      .json({ message: "Reminder added successfully", reminder: doc });
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
    
    const message = isCompleted 
      ? "Reminder marked as completed" 
      : "Reminder marked as incomplete";
      
    res
      .status(200)
      .json({ message, reminder: updated });
  } catch (err) {
    const e = new Error("An error occurred while updating the reminder completion status.");
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
