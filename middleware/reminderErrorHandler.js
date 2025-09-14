// Middleware לטיפול בשגיאות ספציפיות לתזכורות
const reminderErrorHandler = (error, req, res, next) => {
  console.error("🚨 Reminder Error Handler:", {
    error: error.message,
    stack: error.stack,
    requestId: req.requestId,
    userId: req.user?._id,
    reminderId: req.params?.reminderId,
  });

  // שגיאות ספציפיות לתזכורות
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "שגיאה בנתוני התזכורת",
      errors: Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      })),
      requestId: req.requestId,
    });
  }

  if (error.name === "CastError" && error.path === "_id") {
    return res.status(400).json({
      success: false,
      message: "מזהה תזכורת לא תקין",
      requestId: req.requestId,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "תזכורת דומה כבר קיימת",
      requestId: req.requestId,
    });
  }

  // שגיאות Google Calendar
  if (error.message?.includes("Google Calendar")) {
    return res.status(500).json({
      success: false,
      message: "שגיאה בסנכרון עם גוגל יומן. התזכורת נוצרה אבל לא סונכרנה.",
      requestId: req.requestId,
      warning: true,
    });
  }

  // שגיאות Push Notifications
  if (error.message?.includes("Push notification")) {
    return res.status(500).json({
      success: false,
      message: "שגיאה בשליחת התראה. התזכורת נוצרה אבל ההתראה לא נשלחה.",
      requestId: req.requestId,
      warning: true,
    });
  }

  // שגיאות זמן
  if (error.message?.includes("time") || error.message?.includes("date")) {
    return res.status(400).json({
      success: false,
      message: "שגיאה בתאריך או שעה. אנא בדוק את הפורמט.",
      requestId: req.requestId,
    });
  }

  // שגיאות כלליות
  const statusCode = error.statusCode || 500;
  const message = error.message || "אירעה שגיאה בעיבוד התזכורת";

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      originalError: error.message,
    }),
  });
};

module.exports = reminderErrorHandler;
