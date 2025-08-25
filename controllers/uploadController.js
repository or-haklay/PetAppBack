const {
  s3,
  checkFileAccessibility,
  getPublicUrl,
  uploadToS3,
} = require("../config/s3Config");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

module.exports = {
  // העלאת תמונת פרופיל
  uploadProfilePicture: async (req, res, next) => {
    try {
      if (!req.file) {
        const error = new Error("לא נבחר קובץ");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      // בדיקות נוספות
      if (!req.file.buffer || req.file.buffer.length === 0) {
        const error = new Error("הקובץ ריק או פגום");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      if (req.file.size > 10 * 1024 * 1024) {
        // 10MB
        const error = new Error("הקובץ גדול מדי. הגודל המקסימלי הוא 10MB");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      console.log(`📤 מתחיל העלאת תמונת פרופיל: ${req.file.originalname}`);
      console.log(`📏 גודל הקובץ: ${req.file.size} bytes`);
      console.log(`🎨 סוג הקובץ: ${req.file.mimetype}`);

      // העלאה ל-S3 עם AWS SDK v3
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
        req.file.originalname
      }`;

      console.log(`📝 שם הקובץ ב-S3: ${fileName}`);

      await uploadToS3(
        req.file.buffer,
        fileName,
        req.file.mimetype,
        req.requestId
      );

      const fileUrl = getPublicUrl(fileName, req.requestId);
      console.log(`🔗 URL שנוצר: ${fileUrl}`);

      // בדוק שהקובץ נגיש
      const isAccessible = await checkFileAccessibility(
        fileName,
        req.requestId
      );
      if (!isAccessible) {
        console.warn("⚠️ File uploaded but not accessible:", fileName);
      }

      res.json({
        success: true,
        fileUrl,
        message: "תמונת פרופיל הועלתה בהצלחה",
        requestId: req.requestId,
      });
    } catch (error) {
      console.error("❌ Error in uploadProfilePicture:", error);

      // הוספת פרטים נוספים על השגיאה
      if (error.name === "S3ServiceException") {
        console.error(`📦 S3 Error Code: ${error.$metadata?.httpStatusCode}`);
        console.error(`📦 S3 Error Message: ${error.message}`);
      } else if (error.name === "S3EndpointError") {
        console.error(`🔧 S3 Endpoint Error: ${error.message}`);
        console.error(`🔧 פתרון: ${error.message}`);
      }

      error.status = 500;
      next(error);
    }
  },

  // העלאת תמונת חיה
  uploadPetPicture: async (req, res, next) => {
    try {
      if (!req.file) {
        const error = new Error("לא נבחר קובץ");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      // בדיקות נוספות
      if (!req.file.buffer || req.file.buffer.length === 0) {
        const error = new Error("הקובץ ריק או פגום");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      if (req.file.size > 10 * 1024 * 1024) {
        // 10MB
        const error = new Error("הקובץ גדול מדי. הגודל המקסימלי הוא 10MB");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      console.log(`📤 מתחיל העלאת תמונת חיה: ${req.file.originalname}`);
      console.log(`📏 גודל הקובץ: ${req.file.size} bytes`);
      console.log(`🎨 סוג הקובץ: ${req.file.mimetype}`);

      // העלאה ל-S3 עם AWS SDK v3
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
        req.file.originalname
      }`;

      console.log(`📝 שם הקובץ ב-S3: ${fileName}`);

      await uploadToS3(
        req.file.buffer,
        fileName,
        req.file.mimetype,
        req.requestId
      );

      const fileUrl = getPublicUrl(fileName, req.requestId);
      console.log(`🔗 URL שנוצר: ${fileUrl}`);

      // בדוק שהקובץ נגיש
      const isAccessible = await checkFileAccessibility(
        fileName,
        req.requestId
      );
      if (!isAccessible) {
        console.warn("⚠️ File uploaded but not accessible:", fileName);
      }

      res.json({
        success: true,
        fileUrl,
        message: "תמונת החיה הועלתה בהצלחה",
        requestId: req.requestId,
      });
    } catch (error) {
      console.error("❌ Error in uploadPetPicture:", error);

      // הוספת פרטים נוספים על השגיאה
      if (error.name === "S3ServiceException") {
        console.error(`📦 S3 Error Code: ${error.$metadata?.httpStatusCode}`);
        console.error(`📦 S3 Error Message: ${error.message}`);
      } else if (error.name === "S3EndpointError") {
        console.error(`🔧 S3 Endpoint Error: ${error.message}`);
        console.error(`🔧 פתרון: ${error.message}`);
      }

      error.status = 500;
      next(error);
    }
  },

  // העלאת תמונת רקע של חיה
  uploadPetCover: async (req, res, next) => {
    try {
      if (!req.file) {
        const error = new Error("לא נבחר קובץ");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      // בדיקות נוספות
      if (!req.file.buffer || req.file.buffer.length === 0) {
        const error = new Error("הקובץ ריק או פגום");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      if (req.file.size > 10 * 1024 * 1024) {
        // 10MB
        const error = new Error("הקובץ גדול מדי. הגודל המקסימלי הוא 10MB");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      console.log(`📤 מתחיל העלאת תמונת רקע: ${req.file.originalname}`);
      console.log(`📏 גודל הקובץ: ${req.file.size} bytes`);
      console.log(`🎨 סוג הקובץ: ${req.file.mimetype}`);

      // העלאה ל-S3 עם AWS SDK v3
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
        req.file.originalname
      }`;

      console.log(`📝 שם הקובץ ב-S3: ${fileName}`);

      await uploadToS3(
        req.file.buffer,
        fileName,
        req.file.mimetype,
        req.requestId
      );

      const fileUrl = getPublicUrl(fileName, req.requestId);
      console.log(`🔗 URL שנוצר: ${fileUrl}`);

      // בדוק שהקובץ נגיש
      const isAccessible = await checkFileAccessibility(
        fileName,
        req.requestId
      );
      if (!isAccessible) {
        console.warn("⚠️ File uploaded but not accessible:", fileName);
      }

      res.json({
        success: true,
        fileUrl,
        message: "תמונת הרקע של החיה הועלתה בהצלחה",
        requestId: req.requestId,
      });
    } catch (error) {
      console.error("❌ Error in uploadPetCover:", error);

      // הוספת פרטים נוספים על השגיאה
      if (error.name === "S3ServiceException") {
        console.error(`📦 S3 Error Code: ${error.$metadata?.httpStatusCode}`);
        console.error(`📦 S3 Error Message: ${error.message}`);
      } else if (error.name === "S3EndpointError") {
        console.error(`🔧 S3 Endpoint Error: ${error.message}`);
        console.error(`🔧 פתרון: ${error.message}`);
      }

      error.status = 500;
      next(error);
    }
  },

  // העלאת מסמך רפואי
  uploadMedicalDocument: async (req, res, next) => {
    try {
      if (!req.file) {
        const error = new Error("לא נבחר קובץ");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      // בדיקות נוספות
      if (!req.file.buffer || req.file.buffer.length === 0) {
        const error = new Error("הקובץ ריק או פגום");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      if (req.file.size > 10 * 1024 * 1024) {
        // 10MB
        const error = new Error("הקובץ גדול מדי. הגודל המקסימלי הוא 10MB");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      console.log(`📤 מתחיל העלאת מסמך רפואי: ${req.file.originalname}`);
      console.log(`📏 גודל הקובץ: ${req.file.size} bytes`);
      console.log(`🎨 סוג הקובץ: ${req.file.mimetype}`);

      // העלאה ל-S3 עם AWS SDK v3
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
        req.file.originalname
      }`;

      console.log(`📝 שם הקובץ ב-S3: ${fileName}`);

      await uploadToS3(
        req.file.buffer,
        fileName,
        req.file.mimetype,
        req.requestId
      );

      const fileUrl = getPublicUrl(fileName, req.requestId);
      console.log(`🔗 URL שנוצר: ${fileUrl}`);

      const fileType = req.file.mimetype;
      const fileSize = req.file.size;

      // בדיקת נגישות
      const isAccessible = await checkFileAccessibility(
        fileName,
        req.requestId
      );
      if (!isAccessible) {
        console.warn("⚠️ File uploaded but not accessible:", fileName);
      }

      res.json({
        success: true,
        fileUrl,
        fileMime: fileType,
        fileSize,
        message: "המסמך הרפואי הועלה בהצלחה",
        requestId: req.requestId,
      });
    } catch (error) {
      console.error("❌ Error in uploadMedicalDocument:", error);

      // הוספת פרטים נוספים על השגיאה
      if (error.name === "S3ServiceException") {
        console.error(`📦 S3 Error Code: ${error.$metadata?.httpStatusCode}`);
        console.error(`📦 S3 Error Message: ${error.message}`);
      } else if (error.name === "S3EndpointError") {
        console.error(`🔧 S3 Endpoint Error: ${error.message}`);
        console.error(`🔧 פתרון: ${error.message}`);
      }

      error.status = 500;
      next(error);
    }
  },

  // מחיקת קובץ מ-S3
  deleteFile: async (req, res, next) => {
    try {
      const { fileUrl } = req.body;

      if (!fileUrl) {
        const error = new Error("URL הקובץ חסר");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      // בדיקה שה-URL תקין
      if (!fileUrl.startsWith("http")) {
        const error = new Error("URL הקובץ לא תקין");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      console.log(`🗑️ מנסה למחוק קובץ: ${fileUrl}`);

      // חילוץ שם הקובץ מה-URL
      const fileName = fileUrl.split("/").pop();

      if (!fileName) {
        const error = new Error("לא ניתן לחלץ את שם הקובץ מה-URL");
        error.status = 400;
        error.requestId = req.requestId;
        return next(error);
      }

      console.log(`📝 שם הקובץ למחיקה: ${fileName}`);

      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileName,
      });

      await s3.send(command);
      console.log(`✅ קובץ נמחק בהצלחה: ${fileName}`);

      res.json({
        success: true,
        message: "הקובץ נמחק בהצלחה",
        requestId: req.requestId,
      });
    } catch (error) {
      console.error("❌ Error in deleteFile:", error);

      // הוספת פרטים נוספים על השגיאה
      if (error.name === "S3ServiceException") {
        console.error(`📦 S3 Error Code: ${error.$metadata?.httpStatusCode}`);
        console.error(`📦 S3 Error Message: ${error.message}`);
      } else if (error.name === "S3EndpointError") {
        console.error(`🔧 S3 Endpoint Error: ${error.message}`);
        console.error(`🔧 פתרון: ${error.message}`);
      }

      error.status = 500;
      next(error);
    }
  },
};
