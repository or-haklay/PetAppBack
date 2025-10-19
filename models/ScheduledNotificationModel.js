const mongoose = require("mongoose");

const scheduledNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    targetAudience: {
      type: String,
      enum: ["all", "inactive", "dog_owners", "cat_owners", "specific"],
      default: "all",
    },
    specificUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    scheduledFor: { type: Date, required: true },
    sent: { type: Boolean, default: false },
    sentAt: { type: Date },
    sentCount: { type: Number, default: 0 },
    sound: { type: String, default: "hayotush_notification" },
    type: { type: String, default: "announcement" },
    createdBy: { type: String, default: "admin" },
  },
  { timestamps: true }
);

scheduledNotificationSchema.index({ scheduledFor: 1, sent: 1 });

module.exports = mongoose.model(
  "ScheduledNotification",
  scheduledNotificationSchema
);
