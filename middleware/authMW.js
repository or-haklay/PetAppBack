const jwt = require("jsonwebtoken");
const { User } = require("../models/userModel");

async function authMW(req, res, next) {
  const token = req.header("authorization");
  if (!token) {
    console.log("🚫 [authMW] No token provided for:", req.method, req.path, req.originalUrl);
    const error = new Error("Access denied. No token provided.");
    error.statusCode = 401;
    return next(error);
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_KEY);
    
    // הוספת Google Calendar access token מה-database
    const user = await User.findById(payload._id);
    if (user) {
      req.user = {
        ...payload,
        googleCalendarAccessToken: user.googleCalendarAccessToken,
        googleCalendarRefreshToken: user.googleCalendarRefreshToken,
        googleCalendarTokenExpiry: user.googleCalendarTokenExpiry,
        googleCalendarEnabled: user.googleCalendarEnabled
      };
    } else {
      req.user = payload;
    }
    
    next();
  } catch (err) {
    const error = new Error(err.message || "Invalid token.");
    error.statusCode = 400;
    return next(error);
  }
}

const requireSubscriptionMW = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user || !user.isActiveSubscriber()) {
    const error = new Error("Active subscription required");
    error.statusCode = 403;
    return next(error);
  }
  next();
};

module.exports = {
  authMW,
  requireSubscriptionMW,
};
