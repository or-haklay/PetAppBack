const fs = require("fs");
const path = require("path");
const { uploadToS3, getPublicUrl } = require("../config/s3Config");

async function uploadPdfsToS3() {
  try {
    console.log("🚀 מתחיל העלאת קבצי PDF ל-S3...");

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
        console.log(`📁 מטפל בקובץ: ${file.description}`);
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
