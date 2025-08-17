const mongoose = require("mongoose");
const Joi = require("joi");

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    petId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true }, // dueAt
    time: { type: String }, // אופציונלי "HH:mm"
    isCompleted: { type: Boolean, default: false },
    repeatInterval: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly", "yearly"],
      default: "none",
    },
    timezone: { type: String, default: "Asia/Jerusalem" },
    lastSentAt: { type: Date },
    // שדות חדשים ליומן גוגל
    googleCalendarEventId: { type: String }, // ID של האירוע ביומן
    googleCalendarEventLink: { type: String }, // קישור לאירוע
    syncWithGoogle: { type: Boolean, default: true }, // האם לסנכרן עם גוגל
  },
  { timestamps: true }
);

// Middleware לשלב את התאריך והשעה לפני השמירה
reminderSchema.pre('save', function(next) {
  console.log("🔄 Pre-save middleware triggered:", {
    hasTime: !!this.time,
    hasDate: !!this.date,
    time: this.time,
    date: this.date,
    dateType: typeof this.date
  });

  // אם יש שדה time ויש שדה date, נשלב אותם
  if (this.time && this.date) {
    const timeStr = this.time;
    if (timeStr && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const newDate = new Date(this.date);
      newDate.setHours(hours, minutes, 0, 0);
      
      console.log("⏰ Combining date and time:", {
        originalDate: this.date,
        time: timeStr,
        hours: hours,
        minutes: minutes,
        newDate: newDate
      });
      
      this.date = newDate;
    }
  }
  next();
});

// Middleware לשלב את התאריך והשעה לפני עדכון
reminderSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.time && update.date) {
    const timeStr = update.time;
    if (timeStr && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const newDate = new Date(update.date);
      newDate.setHours(hours, minutes, 0, 0);
      update.date = newDate;
    }
  }
  next();
});

reminderSchema.index({ userId: 1, petId: 1, date: 1, isCompleted: 1 });

const Reminder = mongoose.model("Reminder", reminderSchema, "reminders");

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const reminderCreate = Joi.object({
  petId: objectId.required(),
  title: Joi.string().min(1).required(),
  description: Joi.string().allow(""),
  date: Joi.date().iso().required(),
  time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  repeatInterval: Joi.string()
    .valid("none", "daily", "weekly", "monthly", "yearly")
    .default("none"),
  timezone: Joi.string().default("Asia/Jerusalem"),
  syncWithGoogle: Joi.boolean().default(true), // האם לסנכרן עם גוגל
});

const reminderUpdate = reminderCreate.min(1);

const reminderListQuery = Joi.object({
  petId: objectId,
  onlyUpcoming: Joi.boolean().truthy("1").falsy("0").default(false),
  sort: Joi.string().valid("date", "title", "repeatInterval"),
  order: Joi.string().valid("asc", "desc").default("asc"),
  limit: Joi.number().integer().min(1).max(200),
});

module.exports = {
  Reminder,
  reminderCreate,
  reminderUpdate,
  reminderListQuery,
};
