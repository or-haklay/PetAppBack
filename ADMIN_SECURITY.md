# 🔐 מדריך אבטחה למערכת ניהול התראות

## ⚠️ **חשוב: אבטחת API Key**

### **1. Development (פיתוח):**

- ה-API key מוגדר אוטומטית כ: `hayotush_admin_2024_secure_key_change_this`
- זה בסדר לפיתוח מקומי בלבד!

### **2. Production (ייצור):**

**חובה להגדיר ADMIN_KEY חזק!**

#### **דרך 1: Environment Variables**

```bash
export ADMIN_KEY="your_super_secure_key_here_2024_production"
```

#### **דרך 2: קובץ .env**

צור קובץ `.env` ב-backend:

```env
ADMIN_KEY=your_super_secure_key_here_2024_production
NODE_ENV=production
```

#### **דרך 3: Heroku/Vercel/Netlify**

הגדר ב-environment variables של הפלטפורמה:

- `ADMIN_KEY` = `your_super_secure_key_here_2024_production`

### **3. דוגמאות ל-API Keys חזקים:**

✅ **טוב:**

```
hayotush_admin_2024_secure_key_abc123xyz789
admin_secure_2024_xyz789abc123_def456
hayotush_prod_admin_2024_secure_key_xyz
```

❌ **רע:**

```
admin
password
123456
hayotush_admin
```

### **4. איך להשתמש ב-API:**

#### **שליחה מיידית:**

```bash
curl -X POST http://localhost:3000/api/admin/notifications/send \
  -H "x-admin-key: your_super_secure_key_here_2024_production" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "הודעה חשובה! 🚨",
    "body": "יש עדכון חדש באפליקציה",
    "targetAudience": "all"
  }'
```

#### **תזמון התראה:**

```bash
curl -X POST http://localhost:3000/api/admin/notifications/schedule \
  -H "x-admin-key: your_super_secure_key_here_2024_production" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "תזכורת חשובה",
    "body": "אל תשכח לבדוק את חיית המחמד שלך",
    "targetAudience": "inactive",
    "scheduledFor": "2024-01-20T10:00:00.000Z"
  }'
```

#### **קבלת סטטיסטיקות:**

```bash
curl -X GET http://localhost:3000/api/admin/stats \
  -H "x-admin-key: your_super_secure_key_here_2024_production"
```

### **5. אבטחה נוספת (אופציונלי):**

#### **הגבלת IP:**

```javascript
// ב-adminRoutes.js
const allowedIPs = ["192.168.1.100", "10.0.0.50"];

const ipAuth = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).json({ message: "IP לא מורשה" });
  }
  next();
};

router.use(ipAuth); // הוסף לפני כל ה-routes
```

#### **Rate Limiting:**

```javascript
const rateLimit = require("express-rate-limit");

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 דקות
  max: 100, // מקסימום 100 בקשות
  message: "יותר מדי בקשות, נסה שוב מאוחר יותר",
});

router.use(adminLimiter);
```

### **6. בדיקת אבטחה:**

#### **בדוק שה-API key עובד:**

```bash
# זה צריך לעבוד
curl -H "x-admin-key: your_key" http://localhost:3000/api/admin/stats

# זה צריך להיכשל
curl -H "x-admin-key: wrong_key" http://localhost:3000/api/admin/stats
```

### **7. מה לעשות אם ה-API key נחשף:**

1. **שנה מיד את ה-API key**
2. **בדוק לוגים** - האם מישהו השתמש בו?
3. **הוסף IP restrictions** אם אפשר
4. **שנה את כל ה-passwords** של השרת

---

## 🚨 **זכור:**

- **לעולם אל תעלה API keys ל-Git!**
- **השתמש ב-.gitignore** לקובץ .env
- **שנה את ה-key באופן קבוע** (כל 3-6 חודשים)
- **תעד את ה-keys** במקום בטוח
