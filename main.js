const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const errorLogger = require("./middleware/errorLogger");
const { scheduleDailyMissions } = require("./utils/cron/dailyMissions");

require("dotenv").config();

console.log(`🚀 מאתחל שרת...`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(`🔗 MONGO_URI: ${process.env.MONGO_URI ? "✅ מוגדר" : "❌ חסר"}`);
console.log(`🔑 AWS_REGION: ${process.env.AWS_REGION || "❌ חסר"}`);
console.log(`📦 AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET || "❌ חסר"}`);

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

app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/content", require("./routes/contentRoutes"));

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

console.log(`🔌 מנסה להתחבר ל-MongoDB...`);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    // Start cron after DB is ready
    try {
      scheduleDailyMissions();
      console.log("⏰ Daily missions scheduler started");
    } catch (e) {
      console.error("Failed to start daily missions scheduler:", e);
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌐 Server accessible at: http://localhost:${PORT}`);
      console.log(`📡 API available at: http://localhost:${PORT}/api`);
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
