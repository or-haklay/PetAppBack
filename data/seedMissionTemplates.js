require("dotenv").config();
const mongoose = require("mongoose");
const { MissionTemplate } = require("../models/missionsModel");

const MONGO = process.env.MONGO_URI;

const templates = [
  // Daily activity: find a nearby pet store
  {
    key: "SEARCH_PET_STORE",
    title: "חפש חנות חיות קרובה",
    difficulty: "easy",
    points: 3,
    eventKey: "SEARCH_PET_STORE",
    maxPerDay: 1,
  },
  // Daily activity: read an article (article-specific points granted once-ever server side)
  {
    key: "READ_ARTICLE",
    title: "קרא מאמר",
    difficulty: "medium",
    points: 5,
    eventKey: "READ_ARTICLE",
    maxPerDay: 1,
  },
  // Daily activity: open expenses summary screen
  {
    key: "OPEN_EXPENSES_SUMMARY",
    title: "פתח סיכום הוצאות",
    difficulty: "easy",
    points: 4,
    eventKey: "OPEN_EXPENSES_SUMMARY",
    maxPerDay: 1,
  },
];

(async () => {
  try {
    await mongoose.connect(MONGO);
    for (const t of templates) {
      await MissionTemplate.updateOne({ key: t.key }, t, { upsert: true });
      console.log("Upserted", t.key);
    }
    console.log("Done.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
