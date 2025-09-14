# תיקוני מערכת התזכורות

## בעיות שתוקנו

### 1. ✅ קרונז'ב לשליחת התראות תזכורות

- **קובץ**: `backend/utils/cron/reminderNotifications.js`
- **תיאור**: קרונז'ב שרץ כל 5 דקות ושולח התראות תזכורות
- **פונקציות**:
  - `sendReminderNotifications()` - שליחת התראות
  - `cleanupOldNotifications()` - ניקוי התראות ישנות
  - `createRecurringReminders()` - יצירת תזכורות חוזרות

### 2. ✅ שירות Push Notifications

- **קובץ**: `backend/utils/pushNotificationService.js`
- **תיאור**: שירות לשליחת התראות Push למובייל
- **תכונות**:
  - שליחת התראות יחידות ומרובות
  - בדיקת סטטוס של התראות
  - תמיכה בסוגי התראות שונים (תזכורות, רפואי, הוצאות)

### 3. ✅ תיקון סנכרון התאריכים

- **קובץ**: `backend/controllers/remindersController.js`
- **תיאור**: תיקון סנכרון בין תאריך התזכורת לתאריך ההתראה
- **שינויים**:
  - עדכון התראות בעדכון תזכורות
  - מחיקת התראות במחיקת תזכורות
  - לוגים מפורטים

### 4. ✅ מנגנון חזרה על תזכורות

- **קובץ**: `backend/controllers/remindersController.js`
- **תיאור**: יצירת תזכורות חוזרות אוטומטית
- **תכונות**:
  - תמיכה בחזרה יומית, שבועית, חודשית ושנתית
  - יצירת התראות חדשות לתזכורות חוזרות
  - קרונז'ב יומי ליצירת תזכורות חוזרות

### 5. ✅ שיפור טיפול בשגיאות

- **קובץ**: `backend/middleware/reminderErrorHandler.js`
- **תיאור**: middleware ספציפי לטיפול בשגיאות תזכורות
- **תכונות**:
  - טיפול בשגיאות validation
  - טיפול בשגיאות Google Calendar
  - טיפול בשגיאות Push Notifications
  - הודעות שגיאה ברורות בעברית

### 6. ✅ עדכון מודל המשתמש

- **קובץ**: `backend/models/userModel.js`
- **תיאור**: הוספת שדות ל-Push Notifications
- **שדות חדשים**:
  - `pushToken` - Expo push token
  - `pushNotificationsEnabled` - האם התראות מופעלות

### 7. ✅ API לעדכון Push Token

- **קובץ**: `backend/controllers/usersController.js`
- **נתיב**: `POST /api/users/push-token`
- **תיאור**: עדכון push token של המשתמש

### 8. ✅ עדכון השירות בצד הלקוח

- **קובץ**: `HayotushJS/services/notificationService.js`
- **תיאור**: הוספת פונקציה לעדכון push token

## לוח זמנים של הקרונז'בים

| קרונז'ב        | תדירות    | שעה   | תיאור                         |
| -------------- | --------- | ----- | ----------------------------- |
| שליחת התראות   | כל 5 דקות | -     | שליחת התראות תזכורות          |
| ניקוי התראות   | יומי      | 02:00 | מחיקת התראות ישנות (30+ ימים) |
| תזכורות חוזרות | יומי      | 01:00 | יצירת תזכורות חוזרות          |
| משימות יומיות  | יומי      | 00:05 | יצירת משימות יומיות           |

## איך להשתמש

### 1. הפעלת השרת

```bash
cd backend
npm start
```

### 2. עדכון Push Token מהמובייל

```javascript
import notificationService from "./services/notificationService";

// קבלת push token
const pushToken = await notificationService.getPushToken();

// עדכון בשרת
await notificationService.updatePushToken(pushToken, true);
```

### 3. יצירת תזכורת עם חזרה

```javascript
const reminder = {
  petId: "pet_id",
  title: "להאכיל את החיה",
  description: "זמן לארוחה",
  date: new Date(),
  time: "08:00",
  repeatInterval: "daily", // daily, weekly, monthly, yearly
};
```

## בדיקות

### 1. בדיקת קרונז'ב

```bash
# בדיקת לוגים
tail -f logs/2025-*-error.log

# בדיקת התראות במסד הנתונים
db.notifications.find({type: "reminder"}).sort({createdAt: -1}).limit(5)
```

### 2. בדיקת Push Notifications

```bash
# בדיקת push token במסד הנתונים
db.users.find({pushToken: {$exists: true}})
```

## הערות חשובות

1. **זמן**: כל הקרונז'בים פועלים לפי שעון ישראל (Asia/Jerusalem)
2. **שגיאות**: שגיאות לא מונעות יצירת תזכורות, רק מוסיפות לוגים
3. **ביצועים**: הקרונז'בים פועלים ברקע ולא משפיעים על ביצועי השרת
4. **אבטחה**: Push tokens נשמרים במסד הנתונים ומוגנים
5. **ניקוי**: התראות ישנות נמחקות אוטומטית אחרי 30 יום

## בעיות ידועות

1. **Expo Go**: Push notifications לא עובדות ב-Expo Go, רק ב-development build
2. **Google Calendar**: סנכרון עם גוגל יומן דורש הרשאות מתאימות
3. **Timezone**: יש לוודא שהשרת פועל עם timezone נכון

## תמיכה

אם יש בעיות, בדוק:

1. לוגי השרת
2. לוגי הקרונז'ב
3. סטטוס Push Notifications
4. חיבור למסד הנתונים
