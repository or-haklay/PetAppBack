const {
  MissionTemplate,
  UserDailyMission,
  GamificationEvent,
} = require("../models/missionsModel");
const mongoose = require("mongoose");
const { User } = require("../models/userModel");

const { getILDateKey } = require("./timezone");

async function ensureDailyMissions(userId, dateKey = getILDateKey()) {
  let daily = await UserDailyMission.findOne({ userId, dateKey });
  if (daily) return daily;

  const KEYS = ["SEARCH_PET_STORE", "READ_ARTICLE", "OPEN_EXPENSES_SUMMARY", "DAILY_WALK"];
  const templates = await MissionTemplate.find({ key: { $in: KEYS } })
    .sort({ key: 1 })
    .lean();

  daily = await UserDailyMission.create({
    userId,
    dateKey,
    missions: templates.map((t) => ({
      templateKey: t.key,
      title: t.title,
      points: t.points,
      completed: false,
    })),
  });

  return daily;
}

module.exports = { ensureDailyMissions };

// Internal service: register an event transactionally and award points once per day/target
async function registerEventInternal(userId, { eventKey, targetId }) {
  if (!userId || !eventKey) {
    throw new Error("userId and eventKey are required");
  }

  const dateKey = getILDateKey();
  const uniqueHash = `${userId}|${eventKey}|${targetId || "none"}|${dateKey}`;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const exists = await GamificationEvent.findOne({ uniqueHash }).session(
      session
    );
    if (exists) {
      await session.abortTransaction();
      session.endSession();
      return { ok: true, duplicated: true, pointsAdded: 0 };
    }

    await GamificationEvent.create(
      [{ userId, eventKey, targetId: targetId || null, dateKey, uniqueHash }],
      { session }
    );

    let daily = await UserDailyMission.findOne({ userId, dateKey }).session(
      session
    );
    if (!daily) daily = await ensureDailyMissions(userId, dateKey);

    const tmpl = await MissionTemplate.findOne({ eventKey }).session(session);
    let pointsToAdd = 0;
    if (tmpl && daily) {
      const idx = daily.missions.findIndex(
        (m) => m.templateKey === tmpl.key && !m.completed
      );
      if (idx > -1) {
        daily.missions[idx].completed = true;
        daily.missions[idx].completedAt = new Date();
        pointsToAdd += daily.missions[idx].points || 0;
        await daily.save({ session });
      }
    }

    if (pointsToAdd > 0) {
      await User.updateOne(
        { _id: userId },
        { $inc: { points: pointsToAdd, coins: pointsToAdd } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();
    return { ok: true, pointsAdded: pointsToAdd };
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    throw e;
  }
}

module.exports.registerEventInternal = registerEventInternal;

// Award an idempotent bonus using GamificationEvent with custom unique hash pattern
async function awardBonusOnce(userId, { eventKey, targetId, points }) {
  if (!userId || !eventKey || points <= 0) return { ok: false, pointsAdded: 0 };

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const uniqueHash = `${userId}|${eventKey}|${targetId || "none"}`; // no dateKey → once per logical key
    const exists = await GamificationEvent.findOne({ uniqueHash }).session(
      session
    );
    if (exists) {
      await session.abortTransaction();
      session.endSession();
      return { ok: true, duplicated: true, pointsAdded: 0 };
    }

    await GamificationEvent.create(
      [
        {
          userId,
          eventKey,
          targetId: targetId || null,
          dateKey: null,
          uniqueHash,
        },
      ],
      { session }
    );

    await User.updateOne(
      { _id: userId },
      { $inc: { points: points, coins: points } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return { ok: true, pointsAdded: points };
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    throw e;
  }
}

module.exports.awardBonusOnce = awardBonusOnce;
