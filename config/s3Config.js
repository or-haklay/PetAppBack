const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

// הגדרת AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// הערה חשובה: יש לוודא שה-bucket מאפשר גישה ציבורית לקריאה
// ב-AWS Console: S3 > Bucket > Permissions > Block public access > Uncheck all
// ולהוסיף bucket policy שמאפשר GetObject לכל המשתמשים

// דוגמה ל-bucket policy (יש להחליף את BUCKET_NAME בשם האמיתי של ה-bucket):
/*
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::BUCKET_NAME/*"
        }
    ]
}
*/

// הערה נוספת: אם ה-bucket לא מאפשר ACLs, יש לוודא שה-bucket policy מאפשר גישה ציבורית
// אחרת התמונות לא יהיו נגישות מהקליינט

// הגדרת multer עם S3 - ללא ACL (עובד עם buckets מודרניים)
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    // הסרת ACL - עובד עם buckets מודרניים
    key: function (req, file, cb) {
      // יצירת שם קובץ ייחודי עם timestamp
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
        file.originalname
      }`;
      cb(null, fileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    // הוספת cache control כדי לוודא שהתמונות נטענות כראוי
    cacheControl: "max-age=31536000",
  }),
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

// פונקציה לבדיקת נגישות של קובץ
const checkFileAccessibility = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    };

    await s3.headObject(params).promise();
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

module.exports = { upload, s3, checkFileAccessibility, getPublicUrl };
