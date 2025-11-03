const winston = require("winston");
require("winston-daily-rotate-file");
const path = require("path");

// Error log transport (saves errors to file)
const errorFileTransport = new winston.transports.DailyRotateFile({
  level: "error",
  filename: path.join(__dirname, "..", "logs", "%DATE%-error.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
});

// Combined log transport (saves all levels to file)
const combinedFileTransport = new winston.transports.DailyRotateFile({
  level: "info",
  filename: path.join(__dirname, "..", "logs", "%DATE%-combined.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
});

// Console transport for development
const consoleTransport = new winston.transports.Console({
  level: process.env.NODE_ENV === "production" ? "warn" : "info",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(
      (info) => `${info.timestamp} [${info.level}] ${info.message}`
    )
  ),
});

const logger = winston.createLogger({
  transports: [
    errorFileTransport,
    combinedFileTransport,
    consoleTransport,
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      (info) => {
        // Handle error objects
        if (info.stack) {
          return `${info.timestamp} | ${info.level.toUpperCase()} | ${info.message}\n${info.stack}`;
        }
        return `${info.timestamp} | ${info.level.toUpperCase()} | ${info.message}`;
      }
    )
  ),
  exitOnError: false,
});

module.exports = logger;
