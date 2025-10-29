const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");

// בדיקת environment variables נדרשים
const requiredEnvVars = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ חסרים environment variables נדרשים: ${missingEnvVars.join(", ")}`
  );
  console.error(`❌ אנא הגדר את המשתנים הבאים בקובץ .env:`);
  missingEnvVars.forEach((envVar) => {
    console.error(`   ${envVar}=your_value_here`);
  });
  // Don't exit - continue without S3
  console.warn("⚠️ ממשיך ללא S3 - העלאת קבצים לא תעבוד");
} else {
  console.log(`✅ כל ה-environment variables הנדרשים מוגדרים`);
  console.log(`✅ AWS_S3_BUCKET: "${process.env.AWS_S3_BUCKET}"`);
}

// הגדרת AWS S3 Client v3
console.log(`🔧 מאתחל S3 Client...`);
console.log(`🌍 Region: ${process.env.AWS_REGION}`);

// בדיקה אם ה-region נכון
const bucketName = process.env.AWS_S3_BUCKET;
let correctRegion = process.env.AWS_REGION;

// אם ה-bucket מכיל "prod" או יש בעיה עם region, נשתמש ב-us-east-1
if (
  bucketName &&
  (bucketName.includes("prod") || bucketName.includes("hayotush"))
) {
  correctRegion = "us-east-1";
  console.log(
    `🔧 Bucket ${bucketName} זוהה - משתמש ב-region: ${correctRegion}`
  );
}

console.log(`🌍 Region: ${process.env.AWS_REGION}`);
console.log(`🔧 Corrected Region: ${correctRegion}`);
console.log(
  `🔑 Access Key ID: ${process.env.AWS_ACCESS_KEY_ID ? "✅ מוגדר" : "❌ חסר"}`
);
console.log(
  `🔐 Secret Access Key: ${
    process.env.AWS_SECRET_ACCESS_KEY ? "✅ מוגדר" : "❌ חסר"
  }`
);
console.log(`📦 Bucket: ${process.env.AWS_S3_BUCKET}`);
console.log(
  `🔗 Endpoint: ${process.env.AWS_S3_ENDPOINT || "לא מוגדר (משתמש ב-default)"}`
);

const s3 = new S3Client({
  region: correctRegion, // שימוש ב-region המתוקן
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // הוספת endpoint מותאם אישית אם יש
  ...(process.env.AWS_S3_ENDPOINT && {
    endpoint: process.env.AWS_S3_ENDPOINT.startsWith("http")
      ? process.env.AWS_S3_ENDPOINT
      : `https://${process.env.AWS_S3_ENDPOINT}`,
    forcePathStyle: true, // נדרש עבור endpoints מותאמים אישית
  }),
  // הוספת retry logic
  maxAttempts: 3,
  retryMode: "adaptive",
});

// בדיקה אם ה-bucket צריך endpoint ספציפי
if (bucketName && bucketName.includes("prod")) {
  console.log(`🔧 Bucket ${bucketName} זוהה כ-production bucket`);
  console.log(`🔧 משתמש ב-endpoint הסטנדרטי של AWS`);
}

// בדיקה שה-endpoint תקין
if (process.env.AWS_S3_ENDPOINT) {
  const endpoint = process.env.AWS_S3_ENDPOINT.startsWith("http")
    ? process.env.AWS_S3_ENDPOINT
    : `https://${process.env.AWS_S3_ENDPOINT}`;
  console.log(`🔗 Endpoint מותאם אישית: ${endpoint}`);
}

console.log(`✅ S3 Client אותחל בהצלחה`);

// בדיקה שהשרת יכול להתחבר ל-S3
const testS3Connection = async () => {
  try {
    console.log(`🔍 בודק חיבור ל-S3...`);

    // ניסיון לבדוק את ה-bucket
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: "test-connection.txt",
    });

    // זה ייכשל כי הקובץ לא קיים, אבל זה יבדוק שהחיבור עובד
    await s3.send(command);
  } catch (error) {
    if (error.name === "NotFound") {
      console.log(`✅ חיבור ל-S3 עובד (הקובץ לא קיים, אבל זה בסדר)`);
    } else if (error.name === "AccessDenied") {
      console.log(`✅ חיבור ל-S3 עובד (אין הרשאה לקובץ ספציפי, אבל זה בסדר)`);
    } else if (error.name === "PermanentRedirect") {
      console.log(`⚠️ S3 Bucket דורש endpoint ספציפי: ${error.Endpoint}`);
      console.log(`🔧 אנא הגדר AWS_S3_ENDPOINT=${error.Endpoint} בקובץ .env`);
    } else {
      console.error(`❌ בעיה בחיבור ל-S3:`, error.message);
      console.error(`📦 Error Code: ${error.$metadata?.httpStatusCode}`);
      console.error(`📦 Error Message: ${error.message}`);

      // אם זה PermanentRedirect, נציע פתרון
      if (error.name === "PermanentRedirect" && error.Endpoint) {
        console.error(`🔧 פתרון: הוסף לקובץ .env:`);
        console.error(`   AWS_S3_ENDPOINT=${error.Endpoint}`);
      }
    }
  }
};

// הרצת בדיקת החיבור
testS3Connection();

// יצירת storage מותאם אישית ל-AWS SDK v3
const s3Storage = multer.memoryStorage();

const upload = multer({
  storage: s3Storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB מקסימום (הוגדל מ-10MB)
  },
  fileFilter: (req, file, cb) => {
    console.log(
      `📁 בדיקת קובץ: ${file.originalname}, סוג: ${file.mimetype}, גודל: ${file.size} bytes`
    );

    // בדיקת סוגי קבצים מותרים
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      console.log(`✅ סוג קובץ נתמך: ${file.mimetype}`);
      cb(null, true);
    } else {
      console.error(`❌ סוג קובץ לא נתמך: ${file.mimetype}`);
      cb(
        new Error(
          `סוג קובץ לא נתמך: ${file.mimetype}. רק תמונות ו-PDF נתמכים.`
        ),
        false
      );
    }
  },
  // הוספת error handling
  onError: (error, next) => {
    console.error(`❌ שגיאה ב-multer:`, error);
    next(error);
  },
});

// פונקציה להעלאת קובץ ל-S3
async function uploadToS3(
  fileBuffer,
  fileName,
  mimeType,
  requestId = "unknown"
) {
  try {
    console.log(`📤 [${requestId}] מנסה להעלות קובץ ל-S3: ${fileName}`);
    console.log(`📦 [${requestId}] Bucket: ${process.env.AWS_S3_BUCKET}`);
    console.log(`🌍 [${requestId}] Region: ${process.env.AWS_REGION}`);
    console.log(
      `🔗 [${requestId}] Endpoint: ${process.env.AWS_S3_ENDPOINT || "default"}`
    );

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType,
      CacheControl: "max-age=31536000",
    });

    const result = await s3.send(command);
    console.log(`✅ [${requestId}] קובץ הועלה בהצלחה: ${fileName}`);
    return result;
  } catch (error) {
    console.error(`❌ [${requestId}] שגיאה בהעלאת קובץ ${fileName}:`, error);
    console.error(`📦 [${requestId}] Bucket: ${process.env.AWS_S3_BUCKET}`);
    console.error(`🌍 [${requestId}] Region: ${process.env.AWS_REGION}`);
    console.error(
      `🔗 [${requestId}] Endpoint: ${process.env.AWS_S3_ENDPOINT || "default"}`
    );

    // טיפול מיוחד בשגיאות PermanentRedirect
    if (error.name === "PermanentRedirect") {
      console.error(
        `🔧 [${requestId}] S3 Bucket דורש endpoint ספציפי: ${error.Endpoint}`
      );
      console.error(`🔧 [${requestId}] פתרון: הוסף לקובץ .env:`);
      console.error(`🔧 [${requestId}] AWS_S3_ENDPOINT=${error.Endpoint}`);

      // יצירת שגיאה מותאמת עם הוראות ברורות
      const redirectError = new Error(
        `S3 Bucket דורש endpoint ספציפי: ${error.Endpoint}. אנא הוסף AWS_S3_ENDPOINT=${error.Endpoint} לקובץ .env`
      );
      redirectError.name = "S3EndpointError";
      redirectError.originalError = error;
      throw redirectError;
    }

    // טיפול בשגיאות region
    if (error.name === "AuthorizationHeaderMalformed") {
      console.error(`🔧 [${requestId}] בעיית region: ${error.message}`);
      console.error(
        `🔧 [${requestId}] ה-region הנוכחי: ${process.env.AWS_REGION}`
      );
      console.error(
        `🔧 [${requestId}] ה-region הנדרש: ${error.Region || "לא ידוע"}`
      );
      console.error(
        `🔧 [${requestId}] פתרון: שנה את AWS_REGION ל-${
          error.Region || "us-east-1"
        } בקובץ .env`
      );

      const regionError = new Error(
        `בעיית region: ה-region ${process.env.AWS_REGION} לא נכון. נדרש: ${
          error.Region || "us-east-1"
        }. אנא שנה את AWS_REGION בקובץ .env`
      );
      regionError.name = "S3RegionError";
      regionError.originalError = error;
      throw regionError;
    }

    throw error;
  }
}

// פונקציה לבדיקת נגישות של קובץ
const checkFileAccessibility = async (key, requestId = "unknown") => {
  try {
    console.log(`🔍 [${requestId}] בודק נגישות של קובץ: ${key}`);

    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });

    await s3.send(command);
    console.log(`✅ [${requestId}] קובץ נגיש: ${key}`);
    return true;
  } catch (error) {
    console.error(
      `❌ [${requestId}] שגיאה בבדיקת נגישות של קובץ ${key}:`,
      error
    );

    // הוספת פרטים נוספים על השגיאה
    if (error.name === "S3ServiceException") {
      console.error(
        `📦 [${requestId}] S3 Error Code: ${error.$metadata?.httpStatusCode}`
      );
      console.error(`📦 [${requestId}] S3 Error Message: ${error.message}`);
    }

    throw error;
  }
};

// פונקציה לקבלת URL ציבורי של קובץ
const getPublicUrl = (key, requestId = "unknown") => {
  console.log(`🔗 [${requestId}] יצירת URL עבור key: ${key}`);
  console.log(
    `🔗 [${requestId}] AWS_S3_BUCKET: "${process.env.AWS_S3_BUCKET}"`
  );
  console.log(
    `🔗 [${requestId}] AWS_S3_ENDPOINT: ${
      process.env.AWS_S3_ENDPOINT || "לא מוגדר"
    }`
  );

  // בדיקה שה-bucket מוגדר
  if (!process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET.trim() === "") {
    console.error(`❌ [${requestId}] AWS_S3_BUCKET לא מוגדר או ריק`);
    throw new Error("AWS_S3_BUCKET לא מוגדר");
  }

  // בדיקה נוספת שה-bucket לא ריק
  if (process.env.AWS_S3_BUCKET.trim() === "") {
    console.error(`❌ [${requestId}] AWS_S3_BUCKET ריק אחרי trim`);
    throw new Error("AWS_S3_BUCKET ריק");
  }

  // בדיקה שה-bucket לא מכיל רק רווחים
  if (process.env.AWS_S3_BUCKET.replace(/\s/g, "") === "") {
    console.error(`❌ [${requestId}] AWS_S3_BUCKET מכיל רק רווחים`);
    throw new Error("AWS_S3_BUCKET מכיל רק רווחים");
  }

  console.log(
    `🔗 [${requestId}] AWS_S3_BUCKET אחרי בדיקות: "${process.env.AWS_S3_BUCKET}"`
  );

  // בדיקה נוספת שה-bucket לא ריק
  if (!process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET.trim() === "") {
    console.error(`❌ [${requestId}] AWS_S3_BUCKET ריק אחרי בדיקות`);
    throw new Error("AWS_S3_BUCKET ריק");
  }

  // יצירת URL נכון ל-S3
  // אם יש endpoint מותאם אישית, נשתמש בו
  if (process.env.AWS_S3_ENDPOINT) {
    let endpoint = process.env.AWS_S3_ENDPOINT;
    if (!endpoint.startsWith("http")) {
      endpoint = `https://${endpoint}`;
    }
    // תמיד נכלול את שם ה-bucket ב-URL
    const url = `${endpoint}/${bucketName}/${key}`;
    console.log(`🔗 [${requestId}] יצירת URL מותאם אישית: ${url}`);
    return url;
  }

  // בדיקה אם זה production bucket
  if (bucketName && bucketName.includes("prod")) {
    // עבור production buckets, נשתמש ב-endpoint הסטנדרטי של AWS
    const url = `https://${bucketName}.s3.amazonaws.com/${key}`;
    console.log(`🔗 [${requestId}] יצירת URL ל-production bucket: ${url}`);

    // בדיקה שה-URL תקין
    if (!url.includes(`${bucketName}.s3.amazonaws.com`)) {
      console.error(`❌ [${requestId}] URL לא תקין - bucket name חסר: ${url}`);
      throw new Error(`URL לא תקין - bucket name חסר: ${url}`);
    }

    return url;
  }

  // אחרת, נשתמש ב-URL הסטנדרטי של AWS
  // עבור buckets רגילים, לא צריך region ב-URL
  console.log(`🔗 [${requestId}] יצירת URL עם bucket: "${bucketName}"`);

  const url = `https://${bucketName}.s3.amazonaws.com/${key}`;
  console.log(`🔗 [${requestId}] יצירת URL סטנדרטי: ${url}`);

  // בדיקה שה-URL תקין
  if (!url.startsWith("https://")) {
    console.error(`❌ [${requestId}] URL לא תקין: ${url}`);
    throw new Error(`URL לא תקין: ${url}`);
  }

  // בדיקה שה-URL לא מכיל רק s3.amazonaws.com (זה אומר שה-bucket ריק)
  if (
    url.includes("s3.amazonaws.com") &&
    !url.includes(`${bucketName}.s3.amazonaws.com`)
  ) {
    console.error(`❌ [${requestId}] URL לא תקין - bucket name חסר: ${url}`);
    console.error(`❌ [${requestId}] AWS_S3_BUCKET: "${bucketName}"`);
    throw new Error(`URL לא תקין - bucket name חסר: ${url}`);
  }

  console.log(`🔗 [${requestId}] URL סופי תקין: ${url}`);
  return url;
};

// פונקציה למחיקת קובץ מ-S3
async function deleteFromS3(fileName, requestId = "unknown") {
  try {
    console.log(`🗑️ [${requestId}] מנסה למחוק קובץ מ-S3: ${fileName}`);

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
    });

    const result = await s3.send(command);
    console.log(`✅ [${requestId}] קובץ נמחק בהצלחה מ-S3: ${fileName}`);
    return result;
  } catch (error) {
    console.error(
      `❌ [${requestId}] שגיאה במחיקת קובץ ${fileName} מ-S3:`,
      error
    );

    // הוספת פרטים נוספים על השגיאה
    if (error.name === "S3ServiceException") {
      console.error(
        `📦 [${requestId}] S3 Error Code: ${error.$metadata?.httpStatusCode}`
      );
      console.error(`📦 [${requestId}] S3 Error Message: ${error.message}`);
    }

    throw error;
  }
}

// ייצוא הפונקציות והאובייקטים
module.exports = {
  s3,
  upload,
  uploadToS3,
  checkFileAccessibility,
  getPublicUrl,
  deleteFromS3,
  testS3Connection,
};
