const mongoose = require("mongoose");
const { User } = require("../models/userModel");
const { ContentArticle, ContentCategory } = require("../models/contentModels");
require("dotenv").config();

async function seedAdminData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Create sample categories
    const categories = [
      {
        key: "health",
        title: "בריאות",
        description: "טיפים ומידע על בריאות הכלב",
        icon: "🏥",
        order: 1,
        active: true,
      },
      {
        key: "nutrition",
        title: "תזונה",
        description: "מדריכי תזונה נכונה לכלבים",
        icon: "🍖",
        order: 2,
        active: true,
      },
      {
        key: "training",
        title: "אילוף",
        description: "טיפים לאילוף וחינוך הכלב",
        icon: "🎓",
        order: 3,
        active: true,
      },
      {
        key: "grooming",
        title: "טיפוח",
        description: "טיפוח וניקיון הכלב",
        icon: "✂️",
        order: 4,
        active: true,
      },
    ];

    console.log("📝 Creating categories...");
    for (const categoryData of categories) {
      const existingCategory = await ContentCategory.findOne({
        key: categoryData.key,
      });
      if (!existingCategory) {
        const category = new ContentCategory(categoryData);
        await category.save();
        console.log(`   ✅ Created category: ${category.title}`);
      } else {
        console.log(`   ⚠️  Category already exists: ${categoryData.title}`);
      }
    }

    // Create sample articles
    const articles = [
      {
        slug: "dog-health-basics",
        categoryKey: "health",
        title: "יסודות הבריאות של הכלב",
        summary: "מדריך מקיף לטיפול נכון בבריאות הכלב שלך",
        heroImage:
          "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800",
        blocks: [
          {
            type: "paragraph",
            text: "בריאות הכלב היא אחד הנושאים החשובים ביותר לכל בעל כלב. במדריך זה נסקור את היסודות החשובים לשמירה על בריאות הכלב שלך.",
          },
          {
            type: "tip",
            text: "בדיקה שגרתית אצל הווטרינר כל 6-12 חודשים יכולה למנוע בעיות בריאותיות חמורות.",
          },
          {
            type: "paragraph",
            text: "חשוב לשים לב לסימנים של מחלות כמו שינוי בהתנהגות, אובדן תיאבון, או שינוי בהרגלי השינה.",
          },
        ],
        tags: ["בריאות", "וטרינר", "מניעה"],
        level: "basic",
        ageStages: ["puppy", "adult", "senior"],
        published: true,
        readingTimeMin: 5,
      },
      {
        slug: "proper-dog-nutrition",
        categoryKey: "nutrition",
        title: "תזונה נכונה לכלבים",
        summary: "כל מה שצריך לדעת על האכלה נכונה של הכלב",
        heroImage:
          "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800",
        blocks: [
          {
            type: "paragraph",
            text: "תזונה נכונה היא הבסיס לבריאות טובה של הכלב. חשוב להבין את הצרכים התזונתיים של הכלב שלך לפי הגיל, הגזע והפעילות שלו.",
          },
          {
            type: "image",
            text: "תמונה של מזון לכלבים",
            url: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600",
          },
          {
            type: "tip",
            text: "גורים צריכים לאכול 3-4 פעמים ביום, בעוד כלבים בוגרים יכולים לאכול 1-2 פעמים ביום.",
          },
        ],
        tags: ["תזונה", "מזון", "גורים", "בוגרים"],
        level: "basic",
        ageStages: ["puppy", "adult"],
        published: true,
        readingTimeMin: 7,
      },
      {
        slug: "basic-dog-training",
        categoryKey: "training",
        title: "אילוף בסיסי לכלבים",
        summary: "מדריך צעד אחר צעד לאילוף כלב חדש",
        heroImage:
          "https://images.unsplash.com/photo-1551717743-49959800b1f6?w=800",
        blocks: [
          {
            type: "paragraph",
            text: "אילוף נכון הוא המפתח לחיים נעימים עם הכלב שלך. במדריך זה נלמד את הפקודות הבסיסיות החשובות ביותר.",
          },
          {
            type: "tip",
            text: "התחל את האילוף בגיל צעיר - גורים לומדים מהר יותר מכלבים בוגרים.",
          },
          {
            type: "paragraph",
            text: "פקודות בסיסיות שכל כלב צריך לדעת: שב, ארצה, בוא, הישאר, לא.",
          },
        ],
        tags: ["אילוף", "פקודות", "גורים", "חינוך"],
        level: "basic",
        ageStages: ["puppy", "adult"],
        published: true,
        readingTimeMin: 10,
      },
    ];

    console.log("\n📝 Creating articles...");
    for (const articleData of articles) {
      const existingArticle = await ContentArticle.findOne({
        slug: articleData.slug,
      });
      if (!existingArticle) {
        const article = new ContentArticle(articleData);
        await article.save();
        console.log(`   ✅ Created article: ${article.title}`);
      } else {
        console.log(`   ⚠️  Article already exists: ${articleData.title}`);
      }
    }

    // Create some sample users
    const sampleUsers = [
      {
        name: "דוד כהן",
        email: "david@example.com",
        password: "password123",
        subscriptionPlan: "premium",
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        points: 150,
        coins: 75,
        termsAccepted: true,
        privacyAccepted: true,
        consentTimestamp: new Date(),
        consentVersion: "1.0",
      },
      {
        name: "שרה לוי",
        email: "sarah@example.com",
        password: "password123",
        subscriptionPlan: "free",
        points: 50,
        coins: 25,
        termsAccepted: true,
        privacyAccepted: true,
        consentTimestamp: new Date(),
        consentVersion: "1.0",
      },
      {
        name: "מיכל ישראלי",
        email: "michal@example.com",
        password: "password123",
        subscriptionPlan: "gold",
        subscriptionExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        points: 300,
        coins: 150,
        termsAccepted: true,
        privacyAccepted: true,
        consentTimestamp: new Date(),
        consentVersion: "1.0",
      },
    ];

    console.log("\n👥 Creating sample users...");
    for (const userData of sampleUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        console.log(`   ✅ Created user: ${user.name} (${user.email})`);
      } else {
        console.log(`   ⚠️  User already exists: ${userData.email}`);
      }
    }

    // Show statistics
    const userCount = await User.countDocuments();
    const articleCount = await ContentArticle.countDocuments();
    const categoryCount = await ContentCategory.countDocuments();
    const adminCount = await User.countDocuments({ isAdmin: true });

    console.log("\n📊 Database Statistics:");
    console.log(`   👥 Total Users: ${userCount}`);
    console.log(`   👑 Admin Users: ${adminCount}`);
    console.log(`   📝 Total Articles: ${articleCount}`);
    console.log(`   📁 Total Categories: ${categoryCount}`);

    console.log("\n✅ Admin data seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding admin data:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
seedAdminData();
