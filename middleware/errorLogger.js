const logger = require("../utils/logger");

const errorLogger = (err, req, res, next) => {
  // Only log if response hasn't been sent yet
  if (!res.headersSent) {
    const statusCode = err.statusCode || 500;

    if (statusCode >= 400) {
      const errorMessage = `Status: ${statusCode}, Message: ${err.message}, URL: ${req.originalUrl}, Method: ${req.method}`;

      logger.error(errorMessage, {
        error: err,
        stack: err.stack,
        statusCode,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?._id,
        requestId: req.requestId
      });
    }

    res.status(statusCode).json({
      status: "error",
      message: err.message || "An internal server error occurred.",
    });
  }
};

module.exports = errorLogger;
