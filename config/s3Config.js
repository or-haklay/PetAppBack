const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");

// הגדרת AWS S3 Client v3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// יצירת storage מותאם אישית ל-AWS SDK v3
const s3Storage = multer.memoryStorage();

const upload = multer({
  storage: s3Storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB מקסימום
  },
  fileFilter: (req, file, cb) => {
    // בדיקת סוגי קבצים מותרים
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("סוג קובץ לא נתמך"), false);
    }
  },
});

// פונקציה להעלאת קובץ ל-S3
async function uploadToS3(fileBuffer, fileName, mimeType) {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
    CacheControl: "max-age=31536000",
  });

  return await s3.send(command);
}

// פונקציה לבדיקת נגישות של קובץ
const checkFileAccessibility = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });

    await s3.send(command);
    return true;
  } catch (error) {
    console.error("Error checking file accessibility:", error);
    return false;
  }
};

// פונקציה לקבלת URL ציבורי של קובץ
const getPublicUrl = (key) => {
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

// פונקציה למחיקת קובץ מ-S3
async function deleteFromS3(fileName) {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileName,
  });

  return await s3.send(command);
}

module.exports = {
  upload,
  s3,
  checkFileAccessibility,
  getPublicUrl,
  uploadToS3,
  deleteFromS3,
};
