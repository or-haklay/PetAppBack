const express = require("express");
const router = express.Router();
const { authMW } = require("../middleware/authMW");
const { adminMW } = require("../middleware/adminMW");
const { upload } = require("../config/s3Config");
const {
  uploadLegalDocument,
  getActiveLegalDocuments,
  getLegalDocumentHistory,
  getLegalDocumentByType,
  acceptLegalDocuments,
  getConsentStatus,
  getConsentStatistics,
} = require("../controllers/legalDocumentsController");

// Public routes
router.get("/active", getActiveLegalDocuments);
router.get("/:type/:language", getLegalDocumentByType);

// Protected routes (require authentication)
router.get("/consent-status", authMW, getConsentStatus);
router.post("/accept", authMW, acceptLegalDocuments);

// Admin routes
router.post(
  "/upload",
  authMW,
  adminMW,
  upload.single("file"),
  uploadLegalDocument
);
router.get("/history", authMW, adminMW, getLegalDocumentHistory);
router.get("/statistics", authMW, adminMW, getConsentStatistics);

module.exports = router;

