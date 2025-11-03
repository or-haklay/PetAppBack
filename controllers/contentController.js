const { ContentCategory, ContentArticle } = require("../models/contentModels");
const { GamificationEvent } = require("../models/missionsModel");
const { User } = require("../models/userModel");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

const DEFAULT_CATEGORIES = [
  { key: "medical", title: "רפואי", order: 1 },
  { key: "routine", title: "שגרה", order: 2 },
  { key: "grooming", title: "טיפוח", order: 3 },
  { key: "training", title: "אילוף", order: 4 },
  { key: "treats", title: "חטיפים", order: 5 },
  { key: "nutrition", title: "תזונה", order: 6 },
  { key: "behavior", title: "התנהגות", order: 7 },
  { key: "dental", title: "בריאות שיניים", order: 8 },
  { key: "safety", title: "ביטחון ובטיחות", order: 9 },
  { key: "enrichment", title: "העשרה וצעצועים", order: 10 },
  { key: "puppy_care", title: "טיפול בגורים", order: 11 },
  { key: "senior_care", title: "טיפול בבוגרים", order: 12 },
];

exports.getCategories = async (req, res) => {
  try {
    const cats = await ContentCategory.find({ active: true })
      .sort({ order: 1, title: 1 })
      .lean();
    if (cats && cats.length) return res.json({ ok: true, categories: cats });
    return res.json({ ok: true, categories: DEFAULT_CATEGORIES });
  } catch (e) {
    logger.error(`getCategories error: ${e.message}`, { error: e, stack: e.stack });
    return res.status(500).json({ ok: false, error: "categories_failed" });
  }
};

exports.listArticles = async (req, res) => {
  try {
    const {
      category,
      q,
      page = 1,
      pageSize = 20,
      sort = "recent",
      level,
      ageStage,
      tags,
      includeUnpublished = false, // New parameter for admin
    } = req.query;

    const filter = {};

    // Only show published articles unless admin requests unpublished
    if (!includeUnpublished) {
      filter.published = true;
    }

    if (category) filter.categoryKey = category;
    if (level) filter.level = level;
    if (ageStage) filter.ageStages = ageStage;
    if (tags) {
      const arr = Array.isArray(tags) ? tags : String(tags).split(",");
      filter.tags = { $in: arr.map((t) => t.trim()).filter(Boolean) };
    }

    if (q) {
      filter.$or = [
        { title: new RegExp(q, "i") },
        { summary: new RegExp(q, "i") },
        { tags: new RegExp(q, "i") },
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const sortSpec =
      sort === "title" ? { title: 1 } : { updatedAt: -1, _id: -1 };

    const [items, total] = await Promise.all([
      ContentArticle.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(Number(pageSize))
        .select(
          "slug title summary heroImage tags readingTimeMin updatedAt published categoryKey"
        )
        .lean(),
      ContentArticle.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      items,
      page: Number(page),
      pageSize: Number(pageSize),
      total,
    });
  } catch (e) {
    console.error("listArticles error", e);
    return res.status(500).json({ ok: false, error: "articles_failed" });
  }
};

exports.getArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const doc = await ContentArticle.findOne({ slug, published: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, article: doc });
  } catch (e) {
    console.error("getArticleBySlug error", e);
    return res.status(500).json({ ok: false, error: "article_failed" });
  }
};

// 5 random published articles (highlights)
exports.getHighlights = async (req, res) => {
  try {
    const n = Math.max(1, Math.min(10, Number(req.query.n || 5)));
    const items = await ContentArticle.aggregate([
      { $match: { published: true } },
      { $sample: { size: n } },
      {
        $project: {
          slug: 1,
          title: 1,
          summary: 1,
          heroImage: 1,
          tags: 1,
          readingTimeMin: 1,
          updatedAt: 1,
          categoryKey: 1,
        },
      },
    ]);
    return res.json({ ok: true, items });
  } catch (e) {
    console.error("getHighlights error", e);
    return res.status(500).json({ ok: false, error: "highlights_failed" });
  }
};

// +7 points once per article per user (ever)
exports.trackRead = async (req, res) => {
  const userId = req?.user?._id;
  const { slug } = req.body || {};
  if (!userId)
    return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!slug) return res.status(400).json({ ok: false, error: "slug_required" });

  try {
    const article = await ContentArticle.findOne({ slug, published: true })
      .select("_id slug")
      .lean();
    if (!article)
      return res.status(404).json({ ok: false, error: "not_found" });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const uniqueHash = `${userId}|READ_ARTICLE|${slug}`; // grant once ever
      const exists = await GamificationEvent.findOne({ uniqueHash }).session(
        session
      );
      if (exists) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ ok: true, duplicated: true, pointsAdded: 0 });
      }

      await GamificationEvent.create(
        [
          {
            userId,
            eventKey: "READ_ARTICLE",
            targetId: slug,
            dateKey: null,
            uniqueHash,
          },
        ],
        { session }
      );

      const POINTS = 7;
      await User.updateOne(
        { _id: userId },
        { $inc: { points: POINTS, coins: POINTS } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();
      return res.json({ ok: true, pointsAdded: POINTS });
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      throw e;
    }
  } catch (e) {
    console.error("trackRead error", e);
    return res.status(500).json({ ok: false, error: "track_failed" });
  }
};
