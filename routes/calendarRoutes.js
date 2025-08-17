// routes/calendarRoutes.js
// Google Calendar integration routes

const express = require('express');
const { authMW } = require('../middleware/authMW');
const {
  checkCalendarAccess,
  enableGoogleCalendar,
  disableGoogleCalendar,
  syncExistingReminders
} = require('../controllers/calendarController');

const router = express.Router();

// כל ה-routes דורשים authentication
router.use(authMW);

// בדיקת גישה ליומן
router.get('/access', checkCalendarAccess);

// הפעלת יומן גוגל
router.post('/enable', enableGoogleCalendar);

// ביטול יומן גוגל
router.post('/disable', disableGoogleCalendar);

// סנכרון תזכורות קיימות
router.post('/sync', syncExistingReminders);

module.exports = router;
