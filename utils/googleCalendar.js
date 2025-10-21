// utils/googleCalendar.js
// Google Calendar integration for reminders

const { google } = require("googleapis");
const { OAuth2Client } = require("google-auth-library");

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_WEB_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  // יצירת תזכורת ביומן
  async createCalendarEvent(accessToken, reminder) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      // יצירת תאריך התחלה עם זמן
      let startDateTime = new Date(reminder.date);
      if (reminder.time) {
        const [hours, minutes] = reminder.time.split(":");
        startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      // תאריך סיום (שעה אחרי)
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      // יצירת תיאור מפורט עם הערות
      let description = "";
      if (reminder.description) {
        description += `📝 הערות: ${reminder.description}\n\n`;
      }
      description += `🐾 אפליקציה: Hayotush\n`;
      description += `📅 נוצר: ${new Date().toLocaleDateString("he-IL")}\n`;

      const event = {
        summary: reminder.title,
        description: description,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: reminder.timezone || "Asia/Jerusalem",
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: reminder.timezone || "Asia/Jerusalem",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 60 }, // תזכורת שעה לפני
            { method: "email", minutes: 60 }, // תזכורת אימייל שעה לפני
          ],
        },
        // הוספת מידע על החיה
        extendedProperties: {
          private: {
            petId: reminder.petId.toString(),
            reminderId: reminder._id.toString(),
            app: "Hayotush",
          },
        },
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
      });

      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error("Error creating Google Calendar event:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // עדכון תזכורת ביומן
  async updateCalendarEvent(accessToken, eventId, reminder) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      // יצירת תאריך התחלה עם זמן
      let startDateTime = new Date(reminder.date);
      if (reminder.time) {
        const [hours, minutes] = reminder.time.split(":");
        startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      // תאריך סיום (שעה אחרי)
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      // יצירת תיאור מפורט עם הערות
      let description = "";
      if (reminder.description) {
        description += `📝 הערות: ${reminder.description}\n\n`;
      }
      description += `🐾 אפליקציה: Hayotush\n`;
      description += `📅 עודכן: ${new Date().toLocaleDateString("he-IL")}\n`;

      const event = {
        summary: reminder.title,
        description: description,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: reminder.timezone || "Asia/Jerusalem",
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: reminder.timezone || "Asia/Jerusalem",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 60 }, // תזכורת שעה לפני
            { method: "email", minutes: 60 }, // תזכורת אימייל שעה לפני
          ],
        },
        extendedProperties: {
          private: {
            petId: reminder.petId.toString(),
            reminderId: reminder._id.toString(),
            app: "Hayotush",
          },
        },
      };

      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: eventId,
        resource: event,
      });

      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error("Error updating Google Calendar event:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // מחיקת תזכורת מהיומן
  async deleteCalendarEvent(accessToken, eventId) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      await calendar.events.delete({
        calendarId: "primary",
        eventId: eventId,
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting Google Calendar event:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // בדיקה אם יש גישה ליומן
  async checkCalendarAccess(accessToken) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      const response = await calendar.calendarList.list();

      return {
        success: true,
        calendars: response.data.items || [],
      };
    } catch (error) {
      console.error("Error checking calendar access:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = GoogleCalendarService;
