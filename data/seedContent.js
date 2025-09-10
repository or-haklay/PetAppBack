require("dotenv").config();
const mongoose = require("mongoose");
const { ContentCategory, ContentArticle } = require("../models/contentModels");

const MONGO = process.env.MONGO_URI;

const categories = [
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

const articles = [
  {
    slug: "nutrition-what-dogs-shouldnt-eat",
    categoryKey: "nutrition",
    title: "מה אסור לכלבים לאכול",
    summary: "מדריך קצר למזונות שכדאי להימנע מהם כדי לשמור על בריאות הכלב.",
    heroImage: "",
    tags: ["תזונה", "בטיחות"],
    readingTimeMin: 3,
    blocks: [
      {
        type: "paragraph",
        text: "ישנם מזונות העלולים להזיק לכלבים גם בכמויות קטנות.",
      },
      {
        type: "tip",
        title: "טיפ",
        text: "הרחיקו שוקולד, ענבים, בצק שמרים ובצל מהישג יד.",
      },
      { type: "paragraph", text: "במקרה חשד להרעלה, פנו מייד לווטרינר." },
    ],
  },
  {
    slug: "training-puppy-first-weeks",
    categoryKey: "training",
    title: "טיפים לאילוף גור חדש",
    summary: "הבסיס לאילוף חיובי: עקביות, חיזוקים קצרים וסבלנות.",
    heroImage: "",
    tags: ["אילוף", "גורים"],
    readingTimeMin: 4,
    blocks: [
      { type: "paragraph", text: "התחילו באילוף קצר של 5-10 דקות ביום." },
      {
        type: "tip",
        title: "חיזוק חיובי",
        text: "תגמלו התנהגות טובה במיידי במילים טובות וחטיף קטן.",
      },
      {
        type: "paragraph",
        text: "שמרו על עקביות במילים ובפקודות לכל בני הבית.",
      },
    ],
  },
  {
    slug: "dental-healthy-teeth-for-dogs",
    categoryKey: "dental",
    title: "בריאות שיניים לכלב",
    summary: "איך לשמור על שיניים וחניכיים בריאות לכלב שלכם.",
    heroImage: "",
    tags: ["שיניים", "בריאות"],
    readingTimeMin: 3,
    blocks: [
      {
        type: "paragraph",
        text: "צחצוח שיניים פעמיים-שלוש בשבוע מסייע למנוע אבנית.",
      },
      {
        type: "tip",
        title: "טיפ",
        text: "הרגילו בהדרגה עם משחה ייעודית לכלבים, לא משחת שיניים אנושית.",
      },
      { type: "paragraph", text: "בדיקות וטרינר תקופתיות יאתרו בעיות מוקדם." },
    ],
  },
  {
    slug: "medical-dog-vaccines-guide",
    categoryKey: "medical",
    title: "חיסונים לכלבים: מדריך מהיר",
    summary: "לוח חיסונים בסיסי ומתי חשוב להגיע לווטרינר.",
    heroImage: "",
    tags: ["חיסונים", "וטרינר"],
    readingTimeMin: 4,
    blocks: [
      {
        type: "paragraph",
        text: "גורים מקבלים סדרת חיסונים החל מגיל 6-8 שבועות.",
      },
      {
        type: "paragraph",
        text: "כלב בוגר זקוק לחיסון שנתי בהתאם להמלצת הווטרינר.",
      },
      {
        type: "tip",
        title: "תזכורת",
        text: "השתמשו בתזכורות באפליקציה כדי לא לפספס מועד חיסון.",
      },
    ],
  },
  {
    slug: "grooming-weekly-routine",
    categoryKey: "grooming",
    title: "שגרת טיפוח שבועית",
    summary: "מה כדאי לכלול בשגרה לשמירה על פרווה ועור בריאים.",
    heroImage: "",
    tags: ["טיפוח", "שגרה"],
    readingTimeMin: 3,
    blocks: [
      {
        type: "paragraph",
        text: "סירוק קצר כמה פעמים בשבוע מפחית נשירה ומונע קשרים.",
      },
      {
        type: "tip",
        title: "רחצה",
        text: "הימנעו מחפיפה תכופה מדי כדי לא לייבש את העור.",
      },
      { type: "paragraph", text: "בידקו אוזניים וציפורניים כחלק מהשגרה." },
    ],
  },
  {
    slug: "safety-home-pet-proofing",
    categoryKey: "safety",
    title: "בטיחות בבית לחיות מחמד",
    summary: "כיצד להפוך את הבית לידידותי ובטוח לכלב או לחתול.",
    heroImage: "",
    tags: ["בטיחות", "בית"],
    readingTimeMin: 3,
    blocks: [
      { type: "paragraph", text: "סגרו גישה לחומרים ניקוי ותרופות." },
      {
        type: "tip",
        title: "חשמל",
        text: "כסו כבלים חשופים והרחיקו מטענים מהישג פה סקרן.",
      },
      {
        type: "paragraph",
        text: "בדקו שאין חפצים קטנים שיכולים להיבלע בטעות.",
      },
    ],
  },
];

(async () => {
  try {
    if (!MONGO) throw new Error("MONGO_URI is not set in environment");
    await mongoose.connect(MONGO);
    console.log("✅ Connected to MongoDB");

    for (const c of categories) {
      await ContentCategory.updateOne(
        { key: c.key },
        { $set: { ...c, active: true } },
        { upsert: true }
      );
      console.log("Upserted category:", c.key);
    }

    for (const a of articles) {
      await ContentArticle.updateOne(
        { slug: a.slug },
        {
          $set: {
            ...a,
            published: true,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      console.log("Upserted article:", a.slug);
    }

    console.log("✅ Content seed completed.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Content seed failed:", e.message);
    process.exit(1);
  }
})();
