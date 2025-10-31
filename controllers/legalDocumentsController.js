const { LegalDocument } = require("../models/legalDocumentModel");
const { User } = require("../models/userModel");
const { uploadToS3, getPublicUrl } = require("../config/s3Config");

// Upload a new legal document (Admin only)
const uploadLegalDocument = async (req, res, next) => {
  try {
    const { type, language, changesSummaryHe, changesSummaryEn, effectiveFrom } = req.body;

    // Validate required fields
    if (!type || !language) {
      const error = new Error("Type and language are required");
      error.statusCode = 400;
      return next(error);
    }

    if (!req.file) {
      const error = new Error("PDF file is required");
      error.statusCode = 400;
      return next(error);
    }

    // Validate file type
    if (req.file.mimetype !== "application/pdf") {
      const error = new Error("Only PDF files are allowed");
      error.statusCode = 400;
      return next(error);
    }

    // Generate version number
    const version = await LegalDocument.generateVersion(type, language);

    // Upload to S3 in legal/ folder
    const fileName = `legal/${type}-${language}-v${version}-${Date.now()}.pdf`;
    
    await uploadToS3(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      req.requestId || "legal-upload"
    );

    const fileUrl = getPublicUrl(fileName, req.requestId || "legal-upload");

    // Deactivate previous active versions
    await LegalDocument.deactivatePrevious(type, language);

    // Create new document
    const legalDocument = new LegalDocument({
      type,
      language,
      version,
      fileUrl,
      fileName: req.file.originalname,
      changesSummary: {
        he: changesSummaryHe || "",
        en: changesSummaryEn || "",
      },
      uploadedBy: req.user._id,
      isActive: true,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
    });

    await legalDocument.save();

    // Mark all users as needing consent update
    await User.updateMany(
      {},
      { $set: { needsConsentUpdate: true } }
    );

    console.log(`✅ Legal document uploaded: ${type} (${language}) v${version}`);
    console.log(`📧 All users marked for consent update`);

    res.status(201).json({
      ok: true,
      message: "Legal document uploaded successfully",
      document: legalDocument,
    });
  } catch (error) {
    console.error("uploadLegalDocument error:", error);
    const dbError = new Error("Error uploading legal document");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get active legal documents (optionally filtered by language)
const getActiveLegalDocuments = async (req, res, next) => {
  try {
    const { language } = req.query;

    const filter = { isActive: true };
    if (language) {
      filter.language = language;
    }

    const documents = await LegalDocument.find(filter)
      .populate("uploadedBy", "name email")
      .sort({ type: 1, language: 1 });

    res.json({
      ok: true,
      documents,
    });
  } catch (error) {
    console.error("getActiveLegalDocuments error:", error);
    const dbError = new Error("Error fetching active legal documents");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get legal document history (Admin only)
const getLegalDocumentHistory = async (req, res, next) => {
  try {
    const { type, language, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (language) filter.language = language;

    const skip = (Number(page) - 1) * Number(limit);

    const [documents, total] = await Promise.all([
      LegalDocument.find(filter)
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      LegalDocument.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      documents,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getLegalDocumentHistory error:", error);
    const dbError = new Error("Error fetching legal document history");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get specific legal document by type and language
const getLegalDocumentByType = async (req, res, next) => {
  try {
    const { type, language } = req.params;

    if (!["privacy", "terms"].includes(type)) {
      const error = new Error("Invalid document type");
      error.statusCode = 400;
      return next(error);
    }

    if (!["he", "en"].includes(language)) {
      const error = new Error("Invalid language");
      error.statusCode = 400;
      return next(error);
    }

    const document = await LegalDocument.getActiveDocument(type, language);

    if (!document) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({
      ok: true,
      document,
    });
  } catch (error) {
    console.error("getLegalDocumentByType error:", error);
    const dbError = new Error("Error fetching legal document");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// User accepts legal documents
const acceptLegalDocuments = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { termsVersion, privacyVersion, termsLanguage, privacyLanguage } = req.body;

    if (!termsVersion || !privacyVersion) {
      const error = new Error("Terms and privacy versions are required");
      error.statusCode = 400;
      return next(error);
    }

    // Verify that these are the active versions
    const [activeTerms, activePrivacy] = await Promise.all([
      LegalDocument.getActiveDocument("terms", termsLanguage || "he"),
      LegalDocument.getActiveDocument("privacy", privacyLanguage || "he"),
    ]);

    if (!activeTerms || activeTerms.version !== termsVersion) {
      const error = new Error("Invalid terms version");
      error.statusCode = 400;
      return next(error);
    }

    if (!activePrivacy || activePrivacy.version !== privacyVersion) {
      const error = new Error("Invalid privacy version");
      error.statusCode = 400;
      return next(error);
    }

    // Update user consent
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          termsAccepted: true,
          privacyAccepted: true,
          consentTimestamp: new Date(),
          "consentVersion.terms": termsVersion,
          "consentVersion.privacy": privacyVersion,
          termsLanguage: termsLanguage || "he",
          privacyLanguage: privacyLanguage || "he",
          needsConsentUpdate: false,
        },
      },
      { new: true }
    ).select("-password");

    console.log(`✅ User ${user.email} accepted legal documents`);

    res.json({
      ok: true,
      message: "Legal documents accepted successfully",
      user,
    });
  } catch (error) {
    console.error("acceptLegalDocuments error:", error);
    const dbError = new Error("Error accepting legal documents");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get consent status for current user
const getConsentStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select(
      "needsConsentUpdate consentVersion consentTimestamp termsLanguage privacyLanguage termsAccepted privacyAccepted"
    );

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    // Get active documents
    const userTermsLang = user.termsLanguage || "he";
    const userPrivacyLang = user.privacyLanguage || "he";

    const [activeTerms, activePrivacy] = await Promise.all([
      LegalDocument.getActiveDocument("terms", userTermsLang),
      LegalDocument.getActiveDocument("privacy", userPrivacyLang),
    ]);

    res.json({
      ok: true,
      needsConsentUpdate: user.needsConsentUpdate,
      currentConsent: {
        terms: user.consentVersion?.terms || "1.0",
        privacy: user.consentVersion?.privacy || "1.0",
        timestamp: user.consentTimestamp,
        termsLanguage: user.termsLanguage,
        privacyLanguage: user.privacyLanguage,
      },
      activeDocuments: {
        terms: activeTerms
          ? {
              version: activeTerms.version,
              fileUrl: activeTerms.fileUrl,
              changesSummary: activeTerms.changesSummary,
              language: activeTerms.language,
            }
          : null,
        privacy: activePrivacy
          ? {
              version: activePrivacy.version,
              fileUrl: activePrivacy.fileUrl,
              changesSummary: activePrivacy.changesSummary,
              language: activePrivacy.language,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("getConsentStatus error:", error);
    const dbError = new Error("Error fetching consent status");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get consent statistics (Admin only)
const getConsentStatistics = async (req, res, next) => {
  try {
    // Get all active documents
    const activeDocuments = await LegalDocument.find({ isActive: true });

    const statistics = [];

    for (const doc of activeDocuments) {
      // Count users who accepted this specific version
      const acceptedCount = await User.countDocuments({
        [`consentVersion.${doc.type}`]: doc.version,
        [`${doc.type}Language`]: doc.language,
        needsConsentUpdate: false,
      });

      // Count users who need to accept
      const needsUpdateCount = await User.countDocuments({
        needsConsentUpdate: true,
      });

      statistics.push({
        type: doc.type,
        language: doc.language,
        version: doc.version,
        acceptedCount,
        needsUpdateCount,
        uploadedAt: doc.createdAt,
      });
    }

    // Total users
    const totalUsers = await User.countDocuments();

    res.json({
      ok: true,
      statistics,
      totalUsers,
    });
  } catch (error) {
    console.error("getConsentStatistics error:", error);
    const dbError = new Error("Error fetching consent statistics");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

module.exports = {
  uploadLegalDocument,
  getActiveLegalDocuments,
  getLegalDocumentHistory,
  getLegalDocumentByType,
  acceptLegalDocuments,
  getConsentStatus,
  getConsentStatistics,
};

