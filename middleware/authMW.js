const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  const token = req.header("x-auth-token");
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
};
