const mongoose = require("mongoose");
const Joi = require("joi");

const notificationTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["reminder", "medical", "expense", "general", "tip", "engagement", "walk"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBuiltIn: {
      type: Boolean,
      default: false, // true = תבנית מובנית שלא ניתן למחוק
    },
    // משתנים שניתן להחליף (placeholders)
    variables: [{
      key: String, // "petName", "date", "amount" וכו'
      label: String, // "שם החיה", "תאריך", "סכום" וכו'
      defaultValue: String, // ערך ברירת מחדל
    }],
    // קישור להגדרות התראה (אופציונלי)
    notificationSettingsType: {
      type: String,
      enum: ["reminder", "medical", "expense", "general", "tip", "engagement", "walk"],
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
  {
    timestamps: true,
  }
);

// אינדקסים
notificationTemplateSchema.index({ type: 1, isActive: 1 });
notificationTemplateSchema.index({ isBuiltIn: 1 });

const NotificationTemplate = mongoose.model(
  "NotificationTemplate",
  notificationTemplateSchema,
  "notification_templates"
);

// Joi validation
const notificationTemplateCreate = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid("reminder", "medical", "expense", "general", "tip", "engagement", "walk").required(),
  title: Joi.string().required(),
  body: Joi.string().required(),
  description: Joi.string().allow(""),
  isActive: Joi.boolean(),
  variables: Joi.array().items(
    Joi.object({
      key: Joi.string().required(),
      label: Joi.string().required(),
      defaultValue: Joi.string().allow(""),
    })
  ),
  notificationSettingsType: Joi.string().valid("reminder", "medical", "expense", "general", "tip", "engagement", "walk"),
});

const notificationTemplateUpdate = notificationTemplateCreate.keys({
  name: Joi.string(),
  type: Joi.string().valid("reminder", "medical", "expense", "general", "tip", "engagement", "walk"),
  title: Joi.string(),
  body: Joi.string(),
});

module.exports = {
  NotificationTemplate,
  notificationTemplateCreate,
  notificationTemplateUpdate,
};

