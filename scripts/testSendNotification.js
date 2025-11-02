/**
 * Script to send a test push notification
 * Usage: node scripts/testSendNotification.js <token> <title> <body>
 * Example: node scripts/testSendNotification.js ExponentPushToken[xxx] "Test" "Hello World"
 */

const pushNotificationService = require("../utils/pushNotificationService");

async function sendTestNotification() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log("Usage: node scripts/testSendNotification.js <token> <title> <body>");
    console.log("\nExample:");
    console.log('  node scripts/testSendNotification.js ExponentPushToken[xxx] "Test Title" "Test Body"');
    process.exit(1);
  }

  const [token, title, body] = args;

  console.log("📱 Sending test notification...");
  console.log(`   Token: ${token.substring(0, 30)}...`);
  console.log(`   Title: ${title}`);
  console.log(`   Body: ${body}\n`);

  try {
    const result = await pushNotificationService.sendPushNotification({
      to: token,
      title,
      body,
      data: {
        type: "test",
        timestamp: new Date().toISOString(),
        test: true,
      },
      sound: "default",
    });

    if (result.success) {
      console.log("✅ Notification sent successfully!");
      console.log("   Result:", JSON.stringify(result, null, 2));
    } else {
      console.log("❌ Failed to send notification");
      console.log("   Error:", result.error);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

sendTestNotification();

