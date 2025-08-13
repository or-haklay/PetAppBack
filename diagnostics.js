require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  console.log("🔍 Starting diagnostics...");

  // בדיקה של משתני סביבה
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is missing!");
    process.exit(1);
  } else {
    console.log("✅ MONGO_URI exists");
  }

  // חיבור ל-MongoDB Atlas
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas successfully");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB Atlas:");
    console.error(err.message);
    process.exit(1);
  }

  // בדיקת API Login
  try {
    const express = require("express");
    const app = express();
    app.use(express.json());

    app.post("/api/users/login", (req, res) => {
      res.json({ status: "✅ Login endpoint is reachable", body: req.body });
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Diagnostics server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Error setting up test login route:");
    console.error(err.message);
  }
})();
