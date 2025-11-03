const mongoose = require("mongoose");
const Joi = require("joi");

const automatedNotificationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "walk_reminder",
        "expense_reminder",
        "inactivity_reminder",
        "medical_reminder",
        "monthly_summary",
      ],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    checkFrequency: {
      type: String,
      required: true,
      default: "0 * * * *", // כל שעה (cron expression)
    },
    conditions: {
      daysSinceLastWalk: { type: Number, min: 0 },
      daysSinceLastExpense: { type: Number, min: 0 },
      daysSinceLastAppActivity: { type: Number, min: 0 },
      daysSinceLastMedicalRecord: { type: Number, min: 0 },
      petAgeCategory: {
        type: String,
        enum: ["puppy", "adult", "senior"],
      },
      monthlyExpenseSummary: { type: Boolean, default: false },
    },
    messageTemplate: {
      title: {
        type: String,
        required: true,
      },
      body: {
        type: String,
        required: true,
      },
    },
    notificationSettings: {
      type: {
        type: String,
        enum: [
          "reminder",
          "medical",
          "expense",
          "general",
          "tip",
          "engagement",
          "walk",
          "announcement",
        ],
        default: "general",
      },
      priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      sound: {
        type: String,
        default: "hayotush_notification",
      },
    },
    lastChecked: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// אינדקסים לביצועים טובים יותר
automatedNotificationSchema.index({ enabled: 1, type: 1 });
automatedNotificationSchema.index({ lastChecked: 1 });
automatedNotificationSchema.index({ name: 1 });

const AutomatedNotification = mongoose.model(
  "AutomatedNotification",
  automatedNotificationSchema
);

// Joi validation
const automatedNotificationCreate = Joi.object({
  name: Joi.string().required().trim(),
  type: Joi.string()
    .valid(
      "walk_reminder",
      "expense_reminder",
      "inactivity_reminder",
      "medical_reminder",
      "monthly_summary"
    )
    .required(),
  enabled: Joi.boolean(),
  checkFrequency: Joi.string().required(),
  conditions: Joi.object({
    daysSinceLastWalk: Joi.number().min(0),
    daysSinceLastExpense: Joi.number().min(0),
    daysSinceLastAppActivity: Joi.number().min(0),
    daysSinceLastMedicalRecord: Joi.number().min(0),
    petAgeCategory: Joi.string().valid("puppy", "adult", "senior"),
    monthlyExpenseSummary: Joi.boolean(),
  }),
  messageTemplate: Joi.object({
    title: Joi.string().required(),
    body: Joi.string().required(),
  }).required(),
  notificationSettings: Joi.object({
    type: Joi.string().valid(
      "reminder",
      "medical",
      "expense",
      "general",
      "tip",
      "engagement",
      "walk",
      "announcement"
    ),
    priority: Joi.string().valid("low", "medium", "high"),
    sound: Joi.string(),
  }),
});

const automatedNotificationUpdate = Joi.object({
  name: Joi.string().trim(),
  type: Joi.string().valid(
    "walk_reminder",
    "expense_reminder",
    "inactivity_reminder",
    "medical_reminder",
    "monthly_summary"
  ),
  enabled: Joi.boolean(),
  checkFrequency: Joi.string(),
  conditions: Joi.object({
    daysSinceLastWalk: Joi.number().min(0),
    daysSinceLastExpense: Joi.number().min(0),
    daysSinceLastAppActivity: Joi.number().min(0),
    daysSinceLastMedicalRecord: Joi.number().min(0),
    petAgeCategory: Joi.string().valid("puppy", "adult", "senior"),
    monthlyExpenseSummary: Joi.boolean(),
  }),
  messageTemplate: Joi.object({
    title: Joi.string(),
    body: Joi.string(),
  }),
  notificationSettings: Joi.object({
    type: Joi.string().valid(
      "reminder",
      "medical",
      "expense",
      "general",
      "tip",
      "engagement",
      "walk",
      "announcement"
    ),
    priority: Joi.string().valid("low", "medium", "high"),
    sound: Joi.string(),
  }),
});

module.exports = {
  AutomatedNotification,
  automatedNotificationCreate,
  automatedNotificationUpdate,
};

