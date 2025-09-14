const fs = require("fs");
const path = require("path");

// טעינת משתני סביבה מקובץ .env
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// בדיקת משתני סביבה
const requiredEnvVars = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.log("❌ חסרים משתני סביבה נדרשים:");
  missingEnvVars.forEach((envVar) => {
    console.log(`   ${envVar}=your_value_here`);
  });
  console.log("\nאנא הגדר את המשתנים הבאים:");
  console.log("1. דרך משתני סביבה של המערכת");
  console.log("2. או צור קובץ .env בתיקיית backend עם התוכן הבא:");
  console.log("");
  missingEnvVars.forEach((envVar) => {
    console.log(`${envVar}=your_value_here`);
  });
  console.log("");
  console.log("דוגמה:");
  console.log("AWS_REGION=us-east-1");
  console.log("AWS_ACCESS_KEY_ID=your_access_key");
  console.log("AWS_SECRET_ACCESS_KEY=your_secret_key");
  console.log("AWS_S3_BUCKET=your_bucket_name");
  process.exit(1);
}

// טעינת התצורה רק אחרי בדיקת המשתנים
const { uploadToS3, getPublicUrl } = require("../config/s3Config");

async function uploadPdfsToS3() {
  try {
    console.log("🚀 מתחיל העלאת קבצי PDF ל-S3...");
    console.log(`📦 Bucket: ${process.env.AWS_S3_BUCKET}`);
    console.log(`🌍 Region: ${process.env.AWS_REGION}`);

    // נתיבים לקבצי ה-PDF
    const pdfFiles = [
      {
        localPath: path.join(__dirname, "../../links/תנאי שימוש - עדכון 1.pdf"),
        s3Key: "legal/terms-of-service.pdf",
        description: "תנאי שימוש",
      },
      {
        localPath: path.join(
          __dirname,
          "../../links/מדיניות פרטיות - עדכון 1.pdf"
        ),
        s3Key: "legal/privacy-policy.pdf",
        description: "מדיניות פרטיות",
      },
    ];

    const uploadedFiles = [];

    for (const file of pdfFiles) {
      try {
        console.log(`\n📁 מטפל בקובץ: ${file.description}`);
        console.log(`📂 נתיב מקומי: ${file.localPath}`);

        // בדיקה שהקובץ קיים
        if (!fs.existsSync(file.localPath)) {
          console.error(`❌ הקובץ לא קיים: ${file.localPath}`);
          continue;
        }

        // קריאת הקובץ
        const fileBuffer = fs.readFileSync(file.localPath);
        console.log(`📏 גודל הקובץ: ${fileBuffer.length} bytes`);

        // העלאה ל-S3
        console.log(`📤 מעלה ל-S3 עם key: ${file.s3Key}`);
        await uploadToS3(
          fileBuffer,
          file.s3Key,
          "application/pdf",
          "upload-script"
        );

        // יצירת URL ציבורי
        const publicUrl = getPublicUrl(file.s3Key, "upload-script");
        console.log(`🔗 URL ציבורי: ${publicUrl}`);

        uploadedFiles.push({
          description: file.description,
          s3Key: file.s3Key,
          publicUrl: publicUrl,
          size: fileBuffer.length,
        });

        console.log(`✅ ${file.description} הועלה בהצלחה!`);
      } catch (error) {
        console.error(`❌ שגיאה בהעלאת ${file.description}:`, error.message);
        if (error.name === "S3EndpointError") {
          console.error(`🔧 פתרון: ${error.message}`);
        }
      }
    }

    // סיכום
    console.log("\n📊 סיכום העלאה:");
    console.log("================");

    if (uploadedFiles.length > 0) {
      uploadedFiles.forEach((file) => {
        console.log(`✅ ${file.description}:`);
        console.log(`   📁 S3 Key: ${file.s3Key}`);
        console.log(`   🔗 URL: ${file.publicUrl}`);
        console.log(`   📏 גודל: ${(file.size / 1024).toFixed(2)} KB`);
        console.log("");
      });

      // יצירת קובץ JSON עם הקישורים
      const linksData = {
        termsOfService: uploadedFiles.find(
          (f) => f.description === "תנאי שימוש"
        )?.publicUrl,
        privacyPolicy: uploadedFiles.find(
          (f) => f.description === "מדיניות פרטיות"
        )?.publicUrl,
        lastUpdated: new Date().toISOString(),
      };

      const linksPath = path.join(
        __dirname,
        "../../HayotushJS/legal-links.json"
      );
      fs.writeFileSync(linksPath, JSON.stringify(linksData, null, 2));
      console.log(`💾 קישורים נשמרו ב: ${linksPath}`);

      // יצירת קובץ .env לדוגמה
      const envExamplePath = path.join(__dirname, "../.env.example");
      const envExampleContent = `# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_S3_BUCKET=your_bucket_name_here

# Optional: Custom S3 Endpoint (if using non-AWS S3)
# AWS_S3_ENDPOINT=your_custom_endpoint_here
`;
      fs.writeFileSync(envExamplePath, envExampleContent);
      console.log(`📝 קובץ .env.example נוצר ב: ${envExamplePath}`);
    } else {
      console.log("❌ לא הועלו קבצים");
    }
  } catch (error) {
    console.error("❌ שגיאה כללית:", error);
  }
}

// הרצת הסקריפט
if (require.main === module) {
  uploadPdfsToS3();
}

module.exports = { uploadPdfsToS3 };
