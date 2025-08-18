const express = require("express");
const router = express.Router();
const { upload } = require("../config/s3Config");
const uploadController = require("../controllers/uploadController");
const { authMW } = require("../middleware/authMW");

// POST /api/upload/profile-picture
router.post(
  "/profile-picture",
  authMW,
  upload.single("file"), // השדה צריך להיות "file"
  uploadController.uploadProfilePicture
);

// POST /api/upload/pet-picture
router.post(
  "/pet-picture",
  authMW,
  upload.single("file"), // השדה צריך להיות "file"
  uploadController.uploadPetPicture
);

// POST /api/upload/pet-cover
router.post(
  "/pet-cover",
  authMW,
  upload.single("file"), // השדה צריך להיות "file"
  uploadController.uploadPetCover
);

// POST /api/upload/medical-document
router.post(
  "/medical-document",
  authMW,
  upload.single("file"), // השדה צריך להיות "file"
  uploadController.uploadMedicalDocument
);

// DELETE /api/upload/file
router.delete("/file", authMW, uploadController.deleteFile);

module.exports = router;
