const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const errorLogger = require("./middleware/errorLogger");
const { scheduleDailyMissions } = require("./utils/cron/dailyMissions");
const {
  scheduleReminderNotifications,
} = require("./utils/cron/reminderNotifications");
const {
  scheduleEngagementNotifications,
  scheduleNotificationChecks,
} = require("./utils/cron/engagementCron");

// Load environment variables
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");
const envPath = path.join(__dirname, ".env");
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("Error loading .env:", result.error);
}


// הגדרת ADMIN_KEY אם לא קיים
if (!process.env.ADMIN_KEY) {
  // ב-production - תמיד הגדר ADMIN_KEY ב-environment variables!
  if (process.env.NODE_ENV === "production") {
    console.error(
      "❌ ADMIN_KEY לא מוגדר ב-production! הגדר אותו ב-environment variables"
    );
    process.exit(1);
  }
  process.env.ADMIN_KEY = "hayotush_admin_2024_secure_key_change_this";
}

const app = express();
app.use(cors());

app.use(morgan("dev"));
app.use(express.json());

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(
    `📡 [${req.requestId}] ${req.method} ${
      req.path
    } - ${new Date().toISOString()}`
  );

  // הוספת response time logging
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `⏱️ [${req.requestId}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });

  // הוספת request body logging (רק ב-development)
  if (
    process.env.NODE_ENV === "development" &&
    req.body &&
    Object.keys(req.body).length > 0
  ) {
    console.log(
      `📦 [${req.requestId}] Request body:`,
      JSON.stringify(req.body, null, 2)
    );
  }

  // הוספת request headers logging (רק ב-development)
  if (process.env.NODE_ENV === "development" && req.headers) {
    const relevantHeaders = {
      "user-agent": req.headers["user-agent"],
      "content-type": req.headers["content-type"],
      authorization: req.headers["authorization"] ? "Bearer ***" : undefined,
      "content-length": req.headers["content-length"],
    };
    console.log(
      `📋 [${req.requestId}] Request headers:`,
      JSON.stringify(relevantHeaders, null, 2)
    );
  }

  next();
});

app.use("/api/users", require("./routes/usersRoutes"));
app.use("/api/pets", require("./routes/petsRoutes"));

// ודא שיש auth שמכניס req.user.id
app.use("/api/expenses", require("./routes/expensesRoutes"));
app.use("/api/medical-records", require("./routes/medicalRecordsRoutes"));
app.use("/api/reminders", require("./routes/remindersRoutes"));
app.use("/api/notifications", require("./routes/notificationsRoutes"));

app.use("/api/gamification", require("./routes/gamificationRoutes"));

app.use("/api/places", require("./routes/placesRoutes"));
app.use("/api/calendar", require("./routes/calendarRoutes"));
app.use("/api/walks", require("./routes/walksRoutes"));

app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/content", require("./routes/contentRoutes"));
app.use("/api/legal", require("./routes/legalRoutes"));

// Admin routes
app.use("/api/admin", require("./routes/adminRoutes"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    requestId: req.requestId,
    services: {
      mongodb:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      s3: process.env.AWS_S3_BUCKET ? "configured" : "not configured",
    },
  });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));

// Error handling middleware כללי
app.use((error, req, res, next) => {
  console.error(`❌ [${req.requestId}] Error middleware:`, error);
  console.error(`📡 [${req.requestId}] Request: ${req.method} ${req.path}`);
  console.error(`📦 [${req.requestId}] Request body:`, req.body);
  console.error(`📋 [${req.requestId}] Request headers:`, req.headers);
  console.error(`📚 [${req.requestId}] Stack trace:`, error.stack);

  // אם זה שגיאת S3
  if (error.name === "S3ServiceException") {
    console.error(
      `📦 [${req.requestId}] S3 Error Code: ${error.$metadata?.httpStatusCode}`
    );
    console.error(`📦 [${req.requestId}] S3 Error Message: ${error.message}`);

    return res.status(500).json({
      success: false,
      message: "שגיאה בשירות האחסון. אנא נסה שוב מאוחר יותר.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      requestId: req.requestId,
    });
  }

  // אם זה שגיאת S3 Endpoint
  if (error.name === "S3EndpointError") {
    console.error(`🔧 [${req.requestId}] S3 Endpoint Error: ${error.message}`);

    return res.status(500).json({
      success: false,
      message: "שגיאה בהגדרת שירות האחסון. אנא פנה למנהל המערכת.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      requestId: req.requestId,
    });
  }

  // שגיאות אחרות
  const status = error.status || 500;
  const message = error.message || "אירעה שגיאה בשרת";

  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    requestId: req.requestId,
  });
});

app.use(errorLogger);

const PORT = process.env.PORT || 3000;


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    // Start cron jobs after DB is ready
    try {
      scheduleDailyMissions();
      console.log("⏰ Daily missions scheduler started");

      scheduleReminderNotifications();
      console.log("⏰ Reminder notifications scheduler started");

      scheduleEngagementNotifications();
      console.log("⏰ Engagement notifications scheduler started");

      scheduleNotificationChecks();
      console.log("⏰ Scheduled notifications checker started");
    } catch (e) {
      console.error("Failed to start schedulers:", e);
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌐 Server accessible at: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    console.error("🔌 MongoDB URI:", process.env.MONGO_URI);
    process.exit(1);
  });

//listen to port 3000

// Process error handling
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  console.error("📚 Stack trace:", error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  console.error("📚 Reason:", reason);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("🔄 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🔄 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});
