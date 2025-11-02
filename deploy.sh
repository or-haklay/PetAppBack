#!/usr/bin/env bash
set -euo pipefail

HOST="hayotush.com"
USER="ubuntu"
KEY_PATH="/c/Users/orhak/.ssh/lightsail-key.pem"
REMOTE_DIR="/var/www/hayotush/backend"
PM2_APP="hayotush-backend"

echo "🚀 מתחיל פריסה (Backend)..."

echo "📤 מעלה קבצים לשרת..."
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'logs' \
  --exclude '.git' \
  -e "ssh -i $KEY_PATH" \
  . "$USER@$HOST:$REMOTE_DIR/"

echo "📦 מתקין dependencies בשרת..."
ssh -i "$KEY_PATH" "$USER@$HOST" "cd $REMOTE_DIR && npm install --production"

echo "🔄 מפעיל מחדש PM2..."
ssh -i "$KEY_PATH" "$USER@$HOST" "pm2 restart $PM2_APP || pm2 start $REMOTE_DIR/main.js --name $PM2_APP"

echo "✅ הושלם! 🌐 Backend deployed successfully"

