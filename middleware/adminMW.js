function adminMW(req, res, next) {
  // Check if user is authenticated and is admin
  if (!req.user || !req.user.isAdmin) {
    const error = new Error("Access denied. Admin privileges required.");
    error.statusCode = 403;
    return next(error);
  }

  // Add admin flag to request for convenience
  req.isAdmin = true;
  next();
}

module.exports = { adminMW };
