const { User } = require("../models/userModel"); // קבל את המודל הנכון
const {
  ensureDailyMissions,
  registerEventInternal,
  awardBonusOnce,
} = require("../utils/gamificationService");
const { getILDateKey } = require("../utils/timezone");

// Level and Rank system configuration
const LEVEL_SYSTEM = {
  // Level thresholds (by points)
  levelThresholds: [
    50, 125, 225, 350, 500, 675, 875, 1100, 1350, 1625, 1925, 2250, 2600, 2975,
    3375, 3800, 4250, 4725, 5225, 5750, 6300, 6875, 7475, 8100, 8750, 9425,
    10125, 10850, 11600, 12375, 13175, 14000, 14850, 15725, 16625, 17550, 18500,
    19475, 20475, 21500, 22550, 23625, 24725, 25850, 27000, 28175, 29375, 30600,
    31850, 33125, 34425, 35750, 37100, 38475, 39875, 41300, 42750, 44225, 45725,
    47250, 48800, 50375, 51975, 53600, 55250, 56925, 58625, 60350, 62100, 63875,
    65675, 67500, 69350, 71225, 73125, 75050, 77000, 78975, 80975, 83000, 85050,
    87125, 89225, 91350, 93500, 95675, 97875, 100100, 102350, 104625, 106925,
    109250, 111600, 113975, 116375, 118800, 121250, 123725, 126225, 128750,
    131300, 133875, 136475, 139100, 141750, 144425, 147125, 149850, 152600,
    155375, 158175, 161000, 163850, 166725, 169625, 172550, 175500, 178475,
    181475, 184500, 187550, 190625, 193725, 196850, 200000,
  ],
  // Ranks (by level count)
  ranks: [
    { name: "wood", minLevel: 0, maxLevel: 9, color: "#8B4513", icon: "🌳" },
    {
      name: "bronze",
      minLevel: 10,
      maxLevel: 24,
      color: "#CD7F32",
      icon: "🥉",
    },
    {
      name: "silver",
      minLevel: 25,
      maxLevel: 49,
      color: "#C0C0C0",
      icon: "🥈",
    },
    { name: "gold", minLevel: 50, maxLevel: 99, color: "#FFD700", icon: "🥇" },
    {
      name: "diamond",
      minLevel: 100,
      maxLevel: 199,
      color: "#B9F2FF",
      icon: "💎",
    },
    {
      name: "legendary",
      minLevel: 200,
      maxLevel: Infinity,
      color: "#FF6B6B",
      icon: "👑",
    },
  ],
};

function calculateLevelAndRank(points) {
  // Calculate level based on points
  let level = 0;
  for (let i = 0; i < LEVEL_SYSTEM.levelThresholds.length; i++) {
    if (points >= LEVEL_SYSTEM.levelThresholds[i]) {
      level = i + 1; // Level 1 starts at 50 points, level 2 at 125, etc.
    } else {
      break;
    }
  }

  // Calculate rank based on level
  const rank =
    LEVEL_SYSTEM.ranks.find(
      (r) => level >= r.minLevel && level <= r.maxLevel
    ) || LEVEL_SYSTEM.ranks[LEVEL_SYSTEM.ranks.length - 1];

  // Calculate points to next level
  const pointsToNextLevel =
    level < LEVEL_SYSTEM.levelThresholds.length
      ? LEVEL_SYSTEM.levelThresholds[level] - points
      : 0;

  // Calculate points in current level
  const pointsInCurrentLevel =
    level > 0 ? points - LEVEL_SYSTEM.levelThresholds[level - 1] : points;

  return {
    level,
    rank: rank.name,
    rankDisplayName: rank.name.charAt(0).toUpperCase() + rank.name.slice(1),
    rankColor: rank.color,
    rankIcon: rank.icon,
    pointsToNextLevel,
    pointsInCurrentLevel,
    totalPointsForCurrentLevel:
      level > 0
        ? LEVEL_SYSTEM.levelThresholds[level] -
          LEVEL_SYSTEM.levelThresholds[level - 1]
        : LEVEL_SYSTEM.levelThresholds[0],
  };
}

// GET /api/gamification/summary
exports.getSummary = async (req, res) => {
  try {
    const userId = req.user._id; // נניח שיש לך middleware שמכניס req.user
    let user = await User.findById(
      userId,
      "points coins dailyStreak lastDailyAt"
    ).lean();

    // Daily streak update (once per day, idempotent):
    try {
      const todayKey = getILDateKey();
      const lastKey = user?.lastDailyAt
        ? getILDateKey(new Date(user.lastDailyAt))
        : null;
      if (lastKey !== todayKey) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yesterdayKey = getILDateKey(y);
        const currentStreak = Number(user?.dailyStreak || 0);
        const newStreak = lastKey === yesterdayKey ? currentStreak + 1 : 1;
        const bonus = newStreak % 7 === 0 ? 15 : 0;

        const filter = { _id: userId, lastDailyAt: user?.lastDailyAt || null };
        const update = {
          $set: { lastDailyAt: new Date(), dailyStreak: newStreak },
        };
        if (bonus > 0) update.$inc = { points: bonus, coins: bonus };

        const r = await User.updateOne(filter, update);
        if (r?.modifiedCount) {
          user = await User.findById(
            userId,
            "points coins dailyStreak lastDailyAt"
          ).lean();
        } else {
          // Already updated by another request; refresh
          user = await User.findById(
            userId,
            "points coins dailyStreak lastDailyAt"
          ).lean();
        }
      }
    } catch (e) {
      console.error("[streak] update failed", e);
    }

    // fallback: ודא שיש משימות להיום
    const daily = await ensureDailyMissions(userId);

    // Bonuses (idempotent): daily completion + weekly perfect
    let dailyCompletionBonusToday = false;
    let weeklyPerfectBonusToday = false;
    let dailyCompletionBonusPoints = 0;
    let weeklyPerfectBonusPoints = 0;
    try {
      const completed = Array.isArray(daily?.missions)
        ? daily.missions.filter((m) => m.completed).length
        : 0;
      const allDone =
        completed === (daily?.missions?.length || 0) && completed > 0;
      const todayKey = daily?.dateKey || getILDateKey();
      if (allDone) {
        const r = await awardBonusOnce(userId, {
          eventKey: "DAILY_COMPLETION_BONUS",
          targetId: `day:${todayKey}`,
          points: 5,
        });
        dailyCompletionBonusToday = Boolean(r?.pointsAdded);
        if (dailyCompletionBonusToday) dailyCompletionBonusPoints = 5;
      }

      // Weekly perfect: only if streak multiple of 7 and each of last 7 days had all missions done
      const streak = Number(user?.dailyStreak || 0);
      if (streak > 0 && streak % 7 === 0) {
        // naive check: verify last 7 days docs all have all missions completed
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return getILDateKey(d);
        });
        const { UserDailyMission } = require("../models/missionsModel");
        const docs = await UserDailyMission.find({
          userId,
          dateKey: { $in: days },
        })
          .select("missions dateKey")
          .lean();
        const done7 = days.every((dk) => {
          const doc = docs.find((x) => x.dateKey === dk);
          if (!doc || !Array.isArray(doc.missions) || doc.missions.length === 0)
            return false;
          return doc.missions.every((m) => m.completed === true);
        });
        if (done7) {
          const weekNumber = (() => {
            const d = new Date();
            const onejan = new Date(d.getFullYear(), 0, 1);
            return Math.ceil(
              ((d - onejan) / 86400000 + onejan.getDay() + 1) / 7
            );
          })();
          const weekKey = `${new Date().getFullYear()}-W${weekNumber}`;
          const r2 = await awardBonusOnce(userId, {
            eventKey: "WEEKLY_PERFECT_BONUS",
            targetId: weekKey,
            points: 30,
          });
          weeklyPerfectBonusToday = Boolean(r2?.pointsAdded);
          if (weeklyPerfectBonusToday) weeklyPerfectBonusPoints = 30;
        }
      }
    } catch (e) {
      console.error("[bonuses] awarding failed", e);
    }

    // last 7 days history summary
    let last7Days = [];
    try {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return getILDateKey(d);
      });
      const { UserDailyMission } = require("../models/missionsModel");
      const docs = await UserDailyMission.find({
        userId,
        dateKey: { $in: days },
      })
        .select("missions dateKey")
        .lean();
      last7Days = days.map((dk) => {
        const doc = docs.find((x) => x.dateKey === dk);
        const total = Array.isArray(doc?.missions) ? doc.missions.length : 0;
        const completedCount = Array.isArray(doc?.missions)
          ? doc.missions.filter((m) => m.completed).length
          : 0;
        return {
          dateKey: dk,
          total,
          completed: completedCount,
          allDone: total > 0 && completedCount === total,
        };
      });
    } catch (e) {
      console.error("[history] build failed", e);
    }

    // Calculate level and rank
    const userPoints = user?.points || 0;
    const levelInfo = calculateLevelAndRank(userPoints);

    res.json({
      ok: true,
      points: userPoints,
      coins: user?.coins || 0,
      dailyStreak: user?.dailyStreak || 0,
      missions: daily.missions,
      dateKey: daily.dateKey,
      dailyCompletionBonusToday,
      weeklyPerfectBonusToday,
      dailyCompletionBonusPoints,
      weeklyPerfectBonusPoints,
      last7Days,
      levelInfo,
    });
  } catch (e) {
    console.error("[getSummary] error", e);
    res.status(500).json({ ok: false, error: "summary_failed" });
  }
};

// POST /api/gamification/event
// body: { eventKey: string, targetId?: string }
exports.registerEvent = async (req, res) => {
  const userId = req.user._id;
  const { eventKey, targetId } = req.body || {};
  if (!eventKey) {
    return res.status(400).json({ ok: false, error: "eventKey_required" });
  }
  try {
    const result = await registerEventInternal(userId, { eventKey, targetId });
    return res.status(200).json(result);
  } catch (e) {
    console.error("[registerEvent] error", e);
    return res.status(500).json({ ok: false, error: "event_failed" });
  }
};
