const winston = require("winston");
require("winston-daily-rotate-file");
const path = require("path");

const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
  level: "error",
  filename: path.join(__dirname, "..", "logs", "%DATE%-error.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
});

const logger = winston.createLogger({
  transports: [dailyRotateFileTransport],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info) =>
        `${info.timestamp} | ${info.level.toUpperCase()} | ${info.message}`
    )
  ),
  exitOnError: false,
});

module.exports = logger;
