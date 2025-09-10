const mongoose = require("mongoose");

const contentBlockSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // 'paragraph' | 'image' | 'tip'
    text: String,
    url: String,
    title: String,
    caption: String,
  },
  { _id: false }
);

const contentCategorySchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    title: { type: String, required: true },
    description: String,
    icon: String,
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const contentArticleSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, required: true },
    categoryKey: { type: String, index: true, required: true },
    title: { type: String, required: true },
    summary: String,
    heroImage: String,
    blocks: [contentBlockSchema],
    tags: [{ type: String, index: true }],
    readingTimeMin: Number,
    level: { type: String, enum: ["basic", "advanced"], default: "basic" },
    ageStages: [{ type: String, enum: ["puppy", "adult", "senior"] }],
    published: { type: Boolean, default: true, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

contentArticleSchema.index({ title: "text", summary: "text", tags: "text" });

const ContentCategory = mongoose.model(
  "ContentCategory",
  contentCategorySchema,
  "content_categories"
);
const ContentArticle = mongoose.model(
  "ContentArticle",
  contentArticleSchema,
  "content_articles"
);

module.exports = { ContentCategory, ContentArticle };
