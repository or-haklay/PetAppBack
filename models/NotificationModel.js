const mongoose = require("mongoose");
const Joi = require("joi");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["reminder", "medical", "expense", "general", "tip", "engagement", "walk", "announcement"],
      default: "general",
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId, // ID של התזכורת/רשומה רפואית וכו'
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    scheduledFor: {
      type: Date,
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    sound: {
      type: String,
      default: "default",
    },
  },
  { timestamps: true }
);

// אינדקסים לביצועים טובים יותר
notificationSchema.index({ userId: 1, isRead: 1, isDeleted: 1 });
notificationSchema.index({ userId: 1, scheduledFor: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

// Joi validation
const notificationCreate = Joi.object({
  title: Joi.string().required(),
  message: Joi.string().required(),
  type: Joi.string().valid("reminder", "medical", "expense", "general"),
  relatedId: Joi.string(),
  scheduledFor: Joi.date().required(),
  priority: Joi.string().valid("low", "medium", "high"),
});

const notificationUpdate = Joi.object({
  isRead: Joi.boolean(),
  isDeleted: Joi.boolean(),
});

module.exports = { Notification, notificationCreate, notificationUpdate };
