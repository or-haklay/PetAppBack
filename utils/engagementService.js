const { User } = require("../models/userModel");
const { Pet } = require("../models/petModel");
const { DAILY_TIPS } = require("../data/dailyTips");
const { ENGAGEMENT_MESSAGES } = require("../data/engagementMessages");
const pushService = require("./pushNotificationService");

// מציאת משתמשים לא פעילים
async function getInactiveUsers() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  return User.find({
    lastAppActivity: { $lt: oneDayAgo },
    pushToken: { $exists: true, $ne: null },
    engagementNotificationsEnabled: true,
    $or: [
      { lastEngagementNotification: { $lt: twoDaysAgo } },
      { lastEngagementNotification: { $exists: false } },
    ],
  }).lean();
}

// בחירת טיפ רנדומלי לפי סוג חיית מחמד
function selectDailyTip(petSpecies) {
  const category = petSpecies || "general";
  const tips = DAILY_TIPS.filter((t) => t.category === category);

  if (tips.length === 0) {
    // fallback לטיפים כלליים
    const generalTips = DAILY_TIPS.filter((t) => t.category === "general");
    return generalTips[Math.floor(Math.random() * generalTips.length)];
  }

  return tips[Math.floor(Math.random() * tips.length)];
}

// בחירת הודעת engagement רנדומלית
function selectEngagementMessage() {
  return ENGAGEMENT_MESSAGES[
    Math.floor(Math.random() * ENGAGEMENT_MESSAGES.length)
  ];
}

// שליחת טיפ יומי
async function sendDailyTip(user, petSpecies) {
  const tip = selectDailyTip(petSpecies);

  await pushService.sendPushNotification({
    to: user.pushToken,
    title: "💡 טיפ יומי",
    body: tip.he,
    sound: "hayotush_notification",
    data: { type: "tip" },
  });
}

// שליחת הודעת engagement
async function sendEngagementMessage(user) {
  const message = selectEngagementMessage();

  await pushService.sendPushNotification({
    to: user.pushToken,
    title: message.title,
    body: message.body,
    sound: "hayotush_notification",
    data: { type: "engagement" },
  });
}

// תהליך ראשי - שולח התראה למשתמשים לא פעילים
async function processInactiveUsers() {
  try {
    const users = await getInactiveUsers();
    console.log(`[Engagement] Found ${users.length} inactive users`);

    let sentCount = 0;

    for (const user of users) {
      try {
        // קבל את חיית המחמד הראשונה של המשתמש
        const pet = await Pet.findOne({ owner: user._id }).lean();
        const petSpecies = pet?.species;

        // 50% סיכוי לטיפ, 50% להודעת engagement
        if (Math.random() > 0.5 && petSpecies) {
          await sendDailyTip(user, petSpecies);
        } else {
          await sendEngagementMessage(user);
        }

        // עדכן timestamp
        await User.updateOne(
          { _id: user._id },
          { lastEngagementNotification: new Date() }
        );

        sentCount++;
      } catch (error) {
        console.error(
          `[Engagement] Error sending to user ${user._id}:`,
          error.message
        );
      }
    }

    console.log(`[Engagement] Sent ${sentCount} notifications`);
    return { success: true, sent: sentCount };
  } catch (error) {
    console.error("[Engagement] Error in processInactiveUsers:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { processInactiveUsers };
