const {
  s3,
  checkFileAccessibility,
  getPublicUrl,
} = require("../config/s3Config");

module.exports = {
  // העלאת תמונת פרופיל
  uploadProfilePicture: async (req, res, next) => {
    try {
      if (!req.file) {
        const error = new Error("לא נבחר קובץ");
        error.status = 400;
        return next(error);
      }

      const fileUrl = req.file.location; // URL מ-S3

      // בדוק שהקובץ נגיש
      const isAccessible = await checkFileAccessibility(req.file.key);
      if (!isAccessible) {
        console.warn("File uploaded but not accessible:", req.file.key);
      }

      res.json({
        success: true,
        fileUrl,
        message: "תמונת פרופיל הועלתה בהצלחה",
      });
    } catch (error) {
      console.error("Error in uploadProfilePicture:", error);
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
        return next(error);
      }

      const fileUrl = req.file.location;

      // בדוק שהקובץ נגיש
      const isAccessible = await checkFileAccessibility(req.file.key);
      if (!isAccessible) {
        console.warn("File uploaded but not accessible:", req.file.key);
      }

      res.json({
        success: true,
        fileUrl,
        message: "תמונת החיה הועלתה בהצלחה",
      });
    } catch (error) {
      console.error("Error in uploadPetPicture:", error);
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
        return next(error);
      }

      const fileUrl = req.file.location;

      // בדוק שהקובץ נגיש
      const isAccessible = await checkFileAccessibility(req.file.key);
      if (!isAccessible) {
        console.warn("File uploaded but not accessible:", req.file.key);
      }

      res.json({
        success: true,
        fileUrl,
        message: "תמונת הרקע של החיה הועלתה בהצלחה",
      });
    } catch (error) {
      console.error("Error in uploadPetCover:", error);
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
        return next(error);
      }

      const fileUrl = req.file.location;
      const fileType = req.file.mimetype;
      const fileSize = req.file.size;

      // בדיקת נגישות
      const isAccessible = await checkFileAccessibility(req.file.key);
      if (!isAccessible) {
        console.warn("File uploaded but not accessible:", req.file.key);
      }

      res.json({
        success: true,
        fileUrl,
        fileMime: fileType,
        fileSize,
        message: "המסמך הרפואי הועלה בהצלחה",
      });
    } catch (error) {
      console.error("Error in uploadMedicalDocument:", error);
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
        return next(error);
      }

      // חילוץ שם הקובץ מה-URL
      const fileName = fileUrl.split("/").pop();

      await s3
        .deleteObject({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: fileName,
        })
        .promise();

      res.json({
        success: true,
        message: "הקובץ נמחק בהצלחה",
      });
    } catch (error) {
      error.status = 500;
      next(error);
    }
  },
};
