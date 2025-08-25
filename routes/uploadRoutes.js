const express = require("express");
const router = express.Router();
const { upload } = require("../config/s3Config");
const uploadController = require("../controllers/uploadController");
const { authMW } = require("../middleware/authMW");
const multer = require("multer");

// Error handling middleware עבור multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error(`❌ Multer Error:`, error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'הקובץ גדול מדי. הגודל המקסימלי הוא 10MB'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: `שגיאה בהעלאת הקובץ: ${error.message}`
    });
  }
  
  if (error) {
    console.error(`❌ Upload Error:`, error);
    return res.status(400).json({
      success: false,
      message: error.message || 'שגיאה בהעלאת הקובץ'
    });
  }
  
  next();
};

// POST /api/upload/profile-picture
router.post(
  "/profile-picture",
  authMW,
  upload.single("file"), // השדה צריך להיות "file"
  handleMulterError,
  uploadController.uploadProfilePicture
);

// POST /api/upload/pet-picture
router.post(
  "/pet-picture",
  authMW,
  upload.single("file"), // השדה צריך להיות "file"
  handleMulterError,
  uploadController.uploadPetPicture
);

// POST /api/upload/pet-cover
router.post(
  "/pet-cover",
  authMW,
  upload.single("file"), // השדה צריך להיות "file"
  handleMulterError,
  uploadController.uploadPetCover
);

// POST /api/upload/medical-document
router.post(
  "/medical-document",
  authMW,
  upload.single("file"), // השדה צריך להיות "file"
  handleMulterError,
  uploadController.uploadMedicalDocument
);

// DELETE /api/upload/file
router.delete("/file", authMW, uploadController.deleteFile);

module.exports = router;
