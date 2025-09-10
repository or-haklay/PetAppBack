// utils/timezone.js
// Use formatInTimeZone from date-fns-tz to avoid ESM/CJS interop issues and manual conversions
const { formatInTimeZone } = require("date-fns-tz");

const TZ = "Asia/Jerusalem";

function getILDateKey(date = new Date()) {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

module.exports = { TZ, getILDateKey };
