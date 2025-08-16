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
  },
  { timestamps: true }
);

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
