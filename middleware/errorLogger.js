const logger = require("../utils/logger");

const errorLogger = (err, req, res, next) => {
  // Only log if response hasn't been sent yet
  if (!res.headersSent) {
    console.log("--- Error Logger Middleware Triggered ---", err);

    const statusCode = err.statusCode || 500;

    if (statusCode >= 400) {
      const errorMessage = `Status: ${statusCode}, Message: ${err.message}, URL: ${req.originalUrl}, Method: ${req.method}`;

      logger.error(errorMessage);
    }

    res.status(statusCode).json({
      status: "error",
      message: err.message || "An internal server error occurred.",
    });
  }
};

module.exports = errorLogger;
