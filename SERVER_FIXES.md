# 🔧 פתרון בעיות בשרת

## בעיה 1: Git Merge Conflict

יש שינויים מקומיים ב-`package.json` ו-`package-lock.json` שמונעים את המיזוג.

### פתרון מהיר:

```bash
# שמור את השינויים המקומיים (אם יש חשיבות להם)
git stash

# או אם אתה לא צריך את השינויים המקומיים:
git checkout -- package.json package-lock.json

# כעת תמשיך עם המיזוג:
git pull origin main
```

## בעיה 2: גרסת Node.js

השרת רץ על Node v18.20.8, אבל `expo-server-sdk@4.0.0` דורש Node >=20.

### אפשרות 1: עדכון Node.js לשרת (מומלץ)

```bash
# התקן nvm (Node Version Manager) אם לא מותקן
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# טען את nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# התקן Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# ודא שהגרסה עודכנה
node --version  # צריך להציג v20.x.x

# הפעל מחדש את PM2 עם Node 20
pm2 restart hayotush-backend --update-env
```

### אפשרות 2: הורדת גרסת expo-server-sdk (זמני)

אם אתה לא יכול לעדכן את Node.js כרגע:

```bash
# התקן גרסה ישנה יותר של expo-server-sdk שתומכת ב-Node 18
npm install expo-server-sdk@3.9.0 --save

# הפעל מחדש
pm2 restart hayotush-backend
```

### אפשרות 3: הגדרת PM2 עם Node 20 ספציפית

אם יש לך Node 20 מותקן אבל PM2 לא משתמש בו:

```bash
# בדוק אילו גרסאות Node מותקנות
which -a node
nvm list  # אם יש nvm

# אם יש Node 20, עדכן את PM2:
pm2 delete hayotush-backend
pm2 start main.js --name hayotush-backend --node-args="--version"  # בדוק
```

## פתרון מלא (מומלץ):

```bash
# 1. פתור את קונפליקט ה-git
cd ~/hayotush/backend
git stash
git pull origin main

# 2. עדכן Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20

# 3. עדכן את npm
npm install -g npm@latest

# 4. התקן מחדש את ה-dependencies
npm install

# 5. הפעל מחדש את PM2
pm2 restart hayotush-backend --update-env
```

## בדיקה:

```bash
# ודא שהכל עובד
node --version  # צריך להציג v20.x.x
npm --version
pm2 list
pm2 logs hayotush-backend --lines 20
```

