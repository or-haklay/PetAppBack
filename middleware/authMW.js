const jwt = require("jsonwebtoken");

function authMW(req, res, next) {
  const token = req.header("authorization");
  if (!token) {
    const error = new Error("Access denied. No token provided.");
    error.statusCode = 401;
    return next(error);
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_KEY);
    req.user = payload; // Attach the user payload to the request object
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
