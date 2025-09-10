const mongoose = require("mongoose");

const missionTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true }, // ex: "ADD_EXPENSE"
    title: { type: String, required: true },
    description: String,
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },
    points: { type: Number, default: 5 },
    maxPerDay: { type: Number, default: 1 },
    eventKey: { type: String, required: true }, // למיפוי אירוע → משימה
  },
  { timestamps: true }
);

const missionItemSchema = new mongoose.Schema(
  {
    templateKey: String,
    title: String,
    points: Number,
    completed: { type: Boolean, default: false },
    completedAt: Date,
  },
  { _id: false }
);

const userDailyMissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, index: true, required: true },
    dateKey: { type: String, index: true, required: true }, // "YYYY-MM-DD"
    missions: [missionItemSchema],
  },
  { timestamps: true }
);

userDailyMissionSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

const gamificationEventSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId,
  eventKey: String, // "ADD_PET", "ADD_EXPENSE", ...
  targetId: String, // להזדהות אובייקט (petId, expenseId...) אם יש
  dateKey: String, // יום האירוע
  uniqueHash: { type: String, unique: true }, // userId|eventKey|targetId|dateKey
  createdAt: { type: Date, default: Date.now },
});

const MissionTemplate = mongoose.model(
  "MissionTemplate",
  missionTemplateSchema,
  "mission_templates"
);
const UserDailyMission = mongoose.model(
  "UserDailyMission",
  userDailyMissionSchema,
  "user_daily_missions"
);
const GamificationEvent = mongoose.model(
  "GamificationEvent",
  gamificationEventSchema,
  "gamification_events"
);

module.exports = {
  MissionTemplate,
  UserDailyMission,
  GamificationEvent,
};
