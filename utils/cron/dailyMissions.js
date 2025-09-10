const cron = require("node-cron");
const { User } = require("../../models/userModel"); // תואם לייצוא בפועל
const { ensureDailyMissions } = require("../gamificationService");
const { TZ, getILDateKey } = require("../timezone");

function scheduleDailyMissions() {
  // ריצה כל יום ב־00:05 שעון ישראל (בטוח ל-DST)
  cron.schedule(
    "5 0 * * *",
    async () => {
      const dateKey = getILDateKey();
      console.log(`[CRON] Start daily missions for ${dateKey}`);

      try {
        // “משתמשים פעילים” – לדוגמה, שעודכנו ב-14 יום אחרונים (כוונן כרצונך)
        const activeSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const users = await User.find(
          { updatedAt: { $gte: activeSince } },
          { _id: 1 }
        ).lean();

        let count = 0;
        for (const u of users) {
          await ensureDailyMissions(u._id, dateKey);
          count++;
        }
        console.log(
          `[CRON] Done daily missions for ${count}/${users.length} users`
        );
      } catch (err) {
        console.error("[CRON] daily missions failed:", err);
      }
    },
    { timezone: TZ }
  );
}

module.exports = { scheduleDailyMissions };
