// controllers/calendarController.js
// Google Calendar integration controller

const GoogleCalendarService = require('../utils/googleCalendar');
const { User } = require('../models/userModel');
const googleCalendar = new GoogleCalendarService();

// בדיקת גישה ליומן
const checkCalendarAccess = async (req, res, next) => {
  try {
    if (!req.user.googleCalendarAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'No Google Calendar access token found'
      });
    }

    const result = await googleCalendar.checkCalendarAccess(
      req.user.googleCalendarAccessToken
    );

    if (result.success) {
      res.json({
        success: true,
        calendars: result.calendars,
        message: 'Calendar access verified'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to access calendar',
        error: result.error
      });
    }
  } catch (err) {
    const e = new Error('An error occurred while checking calendar access');
    e.statusCode = 500;
    next(e);
  }
};

// הפעלת יומן גוגל
const enableGoogleCalendar = async (req, res, next) => {
  try {
    const { accessToken, refreshToken, expiry } = req.body;
    
    if (!accessToken) {
      const e = new Error('Access token is required');
      e.statusCode = 400;
      return next(e);
    }

    // בדיקה שהטוקן עובד
    const result = await googleCalendar.checkCalendarAccess(accessToken);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid access token',
        error: result.error
      });
    }

    // שמירת הטוקנים
    await User.findByIdAndUpdate(req.user._id, {
      googleCalendarAccessToken: accessToken,
      googleCalendarRefreshToken: refreshToken,
      googleCalendarTokenExpiry: expiry ? new Date(expiry) : null,
      googleCalendarEnabled: true
    });

    res.json({
      success: true,
      message: 'Google Calendar enabled successfully',
      calendars: result.calendars
    });
  } catch (err) {
    const e = new Error('An error occurred while enabling Google Calendar');
    e.statusCode = 500;
    next(e);
  }
};

// ביטול יומן גוגל
const disableGoogleCalendar = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpiry: null,
      googleCalendarEnabled: false
    });

    res.json({
      success: true,
      message: 'Google Calendar disabled successfully'
    });
  } catch (err) {
    const e = new Error('An error occurred while disabling Google Calendar');
    e.statusCode = 500;
    next(e);
  }
};

// סנכרון תזכורות קיימות
const syncExistingReminders = async (req, res, next) => {
  try {
    if (!req.user.googleCalendarAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'No Google Calendar access token found'
      });
    }

    const { Reminder } = require('../models/ReminderModel');
    
    // מציאת תזכורות ללא event ID
    const reminders = await Reminder.find({
      userId: req.user._id,
      syncWithGoogle: true,
      $or: [
        { googleCalendarEventId: { $exists: false } },
        { googleCalendarEventId: null }
      ]
    });

    let syncedCount = 0;
    let errorCount = 0;

    for (const reminder of reminders) {
      try {
        const result = await googleCalendar.createCalendarEvent(
          req.user.googleCalendarAccessToken,
          reminder
        );
        
        if (result.success) {
          reminder.googleCalendarEventId = result.eventId;
          reminder.googleCalendarEventLink = result.eventLink;
          await reminder.save();
          syncedCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
        console.error(`Error syncing reminder ${reminder._id}:`, err);
      }
    }

    res.json({
      success: true,
      message: `Sync completed. ${syncedCount} synced, ${errorCount} errors`,
      syncedCount,
      errorCount
    });
  } catch (err) {
    const e = new Error('An error occurred while syncing reminders');
    e.statusCode = 500;
    next(e);
  }
};

module.exports = {
  checkCalendarAccess,
  enableGoogleCalendar,
  disableGoogleCalendar,
  syncExistingReminders
};
