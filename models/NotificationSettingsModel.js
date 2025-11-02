const mongoose = require("mongoose");
const Joi = require("joi");

const notificationSettingsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["reminder", "medical", "expense", "general", "tip", "engagement", "walk"],
      required: true,
      unique: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    
    // תדירות מקסימלית
    frequencyLimit: {
      maxPerHour: {
        type: Number,
        default: 3,
        min: 0,
      },
      maxPerDay: {
        type: Number,
        default: 20,
        min: 0,
      },
    },
    
    // שעות פעילות (מתי לשלוח)
    activeHours: {
      enabled: {
        type: Boolean,
        default: false,
      },
      startHour: {
        type: Number,
        default: 8,
        min: 0,
        max: 23,
      },
      endHour: {
        type: Number,
        default: 22,
        min: 0,
        max: 23,
      },
    },
    
    // הגדרות הודעה
    titlePrefix: {
      type: String,
      default: "",
    },
    petNameInBody: {
      type: Boolean,
      default: false,
    },
    petNameFormat: {
      type: String,
      default: "עבור {petName}",
    },
    
    // הגדרות טכניות
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    sound: {
      type: String,
      default: "hayotush_notification",
    },
    
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// אינדקס לסוג התראה
notificationSettingsSchema.index({ type: 1 });

// Middleware לעדכון enabled כשמשנים isEnabled
notificationSettingsSchema.pre("save", function (next) {
  if (this.isModified("isEnabled")) {
    this.enabled = this.isEnabled;
  }
  if (this.isModified("enabled")) {
    this.isEnabled = this.enabled;
  }
  next();
});

const NotificationSettings = mongoose.model(
  "NotificationSettings",
  notificationSettingsSchema,
  "notification_settings"
);

// Joi validation
const notificationSettingsUpdate = Joi.object({
  isEnabled: Joi.boolean(),
  enabled: Joi.boolean(),
  frequencyLimit: Joi.object({
    maxPerHour: Joi.number().min(0),
    maxPerDay: Joi.number().min(0),
  }),
  activeHours: Joi.object({
    enabled: Joi.boolean(),
    startHour: Joi.number().min(0).max(23),
    endHour: Joi.number().min(0).max(23),
  }),
  titlePrefix: Joi.string().allow(""),
  petNameInBody: Joi.boolean(),
  petNameFormat: Joi.string().allow(""),
  priority: Joi.string().valid("low", "medium", "high"),
  sound: Joi.string(),
});

module.exports = {
  NotificationSettings,
  notificationSettingsUpdate,
};

