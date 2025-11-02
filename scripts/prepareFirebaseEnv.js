#!/usr/bin/env node
/**
 * Script to convert Firebase Service Account JSON file to environment variable format
 * Usage: node scripts/prepareFirebaseEnv.js [path-to-json-file]
 */

const fs = require('fs');
const path = require('path');

// Get the file path from command line or use default
const jsonFilePath = process.argv[2] || path.join(__dirname, '../petapp-de09c-firebase-adminsdk-fbsvc-6d57346403.json');

if (!fs.existsSync(jsonFilePath)) {
  console.error(`❌ קובץ לא נמצא: ${jsonFilePath}`);
  process.exit(1);
}

try {
  // Read and parse the JSON file
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  const jsonObject = JSON.parse(jsonContent);
  
  // Convert to single-line JSON string (escaped for shell)
  const jsonString = JSON.stringify(jsonObject);
  
  // Escape for shell (single quotes and backslashes)
  const escapedString = jsonString.replace(/'/g, "'\\''").replace(/\\/g, '\\\\');
  
  console.log('\n📋 העתק את המשתנה הבא למשתנה סביבה בשרת:\n');
  console.log('═'.repeat(80));
  console.log(`FIREBASE_SERVICE_ACCOUNT='${escapedString}'`);
  console.log('═'.repeat(80));
  
  console.log('\n📝 הוראות להגדרה בשרת:');
  console.log('\n1. התחבר לשרת:');
  console.log('   ssh -i /c/Users/orhak/.ssh/lightsail-key.pem ubuntu@hayotush.com');
  console.log('\n2. הוסף את המשתנה ל-~/.bashrc או ל-~/.profile:');
  console.log('   nano ~/.bashrc');
  console.log('   # הוסף את השורה:');
  console.log('   export FIREBASE_SERVICE_ACCOUNT=\'...הערך שהודפס למעלה...\'');
  console.log('\n3. או הוסף אותו ל-PM2 ecosystem file (אם אתה משתמש ב-PM2):');
  console.log('   pm2 ecosystem');
  console.log('   # הוסף את המשתנה ב-env:');
  console.log('   env: {');
  console.log('     FIREBASE_SERVICE_ACCOUNT: "...הערך..."');
  console.log('   }');
  console.log('\n4. טען מחדש את המשתנים:');
  console.log('   source ~/.bashrc');
  console.log('   # או הפעל מחדש את PM2:');
  console.log('   pm2 restart hayotush-backend');
  console.log('\n✅ הושלם!\n');
  
  // Also save to a file for easier copying
  const outputFile = path.join(__dirname, '../firebase-env-variable.txt');
  fs.writeFileSync(outputFile, `FIREBASE_SERVICE_ACCOUNT='${escapedString}'\n`, 'utf8');
  console.log(`💾 הערך נשמר גם בקובץ: ${outputFile}\n`);
  
} catch (error) {
  console.error('❌ שגיאה:', error.message);
  process.exit(1);
}

