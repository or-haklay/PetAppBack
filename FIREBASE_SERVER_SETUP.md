# 🔥 הגדרת Firebase Admin SDK בשרת

מדריך זה מסביר כיצד להעלות את פרטי Firebase Admin SDK לשרת בצורה מאובטחת.

## 📋 שלב 1: הכנה מקומית

הרץ את הסקריפט הבא כדי להמיר את קובץ ה-JSON לפורמט משתנה סביבה:

```bash
cd backend
node scripts/prepareFirebaseEnv.js
```

הסקריפט ייצור:
- ערך מוכן להעתקה למשתנה סביבה
- קובץ `firebase-env-variable.txt` עם הערך

## 🚀 שלב 2: הגדרה בשרת

### אפשרות 1: הגדרה ב-PM2 (מומלץ)

אם אתה משתמש ב-PM2, הוסף את המשתנה ל-PM2 ecosystem:

```bash
# אם אתה כבר בשרת בתיקייה ~/hayotush/backend:
# צור או ערוך את קובץ ה-ecosystem (אם לא קיים)
pm2 ecosystem

# או אם אתה מתחבר מהמחשב המקומי:
# התחבר לשרת
ssh -i /c/Users/orhak/.ssh/lightsail-key.pem ubuntu@hayotush.com

# עבור לתיקיית הפרויקט
cd ~/hayotush/backend

# צור או ערוך את קובץ ה-ecosystem
pm2 ecosystem
```

הוסף את המשתנה `FIREBASE_SERVICE_ACCOUNT` ל-`env`:

```javascript
module.exports = {
  apps: [{
    name: 'hayotush-backend',
    script: './main.js',
    cwd: '/home/ubuntu/hayotush/backend',
    env: {
      NODE_ENV: 'production',
      FIREBASE_SERVICE_ACCOUNT: '...הערך מקובץ firebase-env-variable.txt...'
      // ... שאר המשתנים
    }
  }]
}
```

הפעל מחדש את PM2:
```bash
pm2 restart hayotush-backend
```

### אפשרות 2: הגדרה ב-~/.bashrc

```bash
# אם אתה כבר בשרת:
# ערוך את ~/.bashrc
nano ~/.bashrc

# הוסף את השורה הבאה (בסוף הקובץ):
export FIREBASE_SERVICE_ACCOUNT='...הערך מקובץ firebase-env-variable.txt...'

# שמור וצא (Ctrl+X, Y, Enter)

# טען את המשתנים מחדש
source ~/.bashrc

# הפעל מחדש את PM2 כדי שיטען את המשתנים
pm2 restart hayotush-backend
```

### אפשרות 3: הגדרה ב-.env בשרת (מומלץ ביותר - פשוט וקל)

```bash
# אם אתה כבר בשרת, עבור לתיקיית הפרויקט:
cd ~/hayotush/backend

# ערוך את קובץ .env (או צור אותו אם לא קיים)
nano .env

# הוסף את השורה:
FIREBASE_SERVICE_ACCOUNT='...הערך מקובץ firebase-env-variable.txt...'

# שמור וצא (Ctrl+X, Y, Enter)

# הפעל מחדש את PM2
pm2 restart hayotush-backend
```

**או אם אתה מתחבר מהמחשב המקומי:**
```bash
# התחבר לשרת
ssh -i /c/Users/orhak/.ssh/lightsail-key.pem ubuntu@hayotush.com

# עבור לתיקיית הפרויקט
cd ~/hayotush/backend

# ערוך את קובץ .env
nano .env

# הוסף את השורה:
FIREBASE_SERVICE_ACCOUNT='...הערך מקובץ firebase-env-variable.txt...'

# שמור וצא

# הפעל מחדש את PM2
pm2 restart hayotush-backend
```

## ✅ שלב 3: בדיקה

לאחר ההגדרה, בדוק שהכל עובד:

```bash
# בדוק שהמשתנה מוגדר
echo $FIREBASE_SERVICE_ACCOUNT

# או בדוק בלוגים של PM2
pm2 logs hayotush-backend

# חפש את ההודעה:
# ✅ Firebase Admin initialized from environment variable
```

## 🔒 אבטחה

- **אל תעלה את קובץ ה-JSON לשרת!** השתמש במשתנה סביבה בלבד
- הקובץ `firebase-env-variable.txt` נכלל ב-.gitignore - אל תעלה אותו ל-Git
- ודא שהמשתנה מוגדר רק בשרת ולא בקוד המקומי

## 📝 הערות

- הקוד ב-`pushNotificationService.js` תומך בשלוש דרכים לטעינת Firebase:
  1. משתנה סביבה `FIREBASE_SERVICE_ACCOUNT` (מומלץ)
  2. משתנה סביבה `FCM_SERVER_KEY`
  3. קובץ JSON בנתיב מסוים (פחות מומלץ לפרודקשן)

- משתנה הסביבה `FIREBASE_SERVICE_ACCOUNT` צריך להיות מחרוזת JSON אחת בשורה, מוקפת בגרשיים

## 🆘 פתרון בעיות

אם Firebase לא מאותחל:
1. בדוק שהמשתנה מוגדר: `echo $FIREBASE_SERVICE_ACCOUNT`
2. בדוק את לוגי PM2: `pm2 logs hayotush-backend`
3. ודא שה-JSON תקין - אפשר לבדוק עם: `echo $FIREBASE_SERVICE_ACCOUNT | jq .`

