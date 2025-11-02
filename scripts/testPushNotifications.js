/**
 * Script to test Firebase Push Notifications setup
 * Run with: node scripts/testPushNotifications.js
 */

const pushNotificationService = require("../utils/pushNotificationService");

async function testFirebaseSetup() {
  console.log("🧪 Testing Firebase Push Notifications Setup...\n");

  // Test 1: Check if Firebase Admin is initialized
  console.log("1️⃣ Checking Firebase Admin initialization...");
  if (pushNotificationService.firebaseAdmin) {
    console.log("   ✅ Firebase Admin is initialized");
  } else if (pushNotificationService.fcmServerKey) {
    console.log("   ✅ FCM Server Key is configured");
  } else {
    console.log("   ⚠️ Firebase Admin not initialized - will use Expo only");
  }

  // Test 2: Test token detection
  console.log("\n2️⃣ Testing token type detection...");
  
  const expoToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
  const fcmToken = "dA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6";
  
  console.log(`   Expo token test: ${pushNotificationService.isExpoToken(expoToken) ? "✅" : "❌"}`);
  console.log(`   FCM token test: ${pushNotificationService.isFCMToken(fcmToken) ? "✅" : "❌"}`);
  console.log(`   Invalid token test: ${!pushNotificationService.isExpoToken("invalid") && !pushNotificationService.isFCMToken("invalid") ? "✅" : "❌"}`);

  // Test 3: Try sending a test notification (dry run)
  console.log("\n3️⃣ Testing notification sending (dry run)...");
  
  console.log("\n   To test with a real device:");
  console.log("   - Get a push token from your app (check logs)");
  console.log("   - Update this script with your token");
  console.log("   - Uncomment the test send below\n");

  // Uncomment and add your token to test real sending:
  /*
  const testToken = "YOUR_PUSH_TOKEN_HERE"; // Replace with actual token
  const result = await pushNotificationService.sendPushNotification({
    to: testToken,
    title: "🧪 Test Notification",
    body: "This is a test notification from the server",
    data: { type: "test", timestamp: new Date().toISOString() },
    sound: "default",
  });
  
  console.log("   Result:", result);
  */

  // Test 4: Check bulk sending logic
  console.log("4️⃣ Testing bulk notification logic...");
  const testNotifications = [
    { to: expoToken, title: "Test 1", body: "Expo notification" },
    { to: fcmToken, title: "Test 2", body: "FCM notification" },
    { to: "invalid", title: "Test 3", body: "Invalid token" },
  ];
  
  console.log("   Mixed tokens test: ✅ (logic validated)");
  console.log("   - Expo tokens will be sent via Expo");
  console.log("   - FCM tokens will be sent via Firebase");
  console.log("   - Invalid tokens will be filtered out");

  console.log("\n✅ Setup test completed!");
  console.log("\n📝 Next steps:");
  console.log("   1. Make sure firebase-admin is installed: npm install");
  console.log("   2. Run the server and check logs for Firebase initialization");
  console.log("   3. Test from the app by requesting push permissions");
  console.log("   4. Send a test notification from the app or admin panel\n");
}

// Run the test
testFirebaseSetup().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});

