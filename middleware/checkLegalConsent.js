const { LegalDocument } = require("../models/legalDocumentModel");

/**
 * Middleware to check if user needs to update their legal consent
 * Should be used after authMW on protected routes
 */
const checkLegalConsent = async (req, res, next) => {
  try {
    // Skip if no user (shouldn't happen if authMW is applied before this)
    if (!req.user) {
      return next();
    }

    // Check if user needs consent update
    if (req.user.needsConsentUpdate === true) {
      console.log(`⚠️ User ${req.user.email} needs consent update`);

      // Get active documents for user's preferred languages
      const userTermsLang = req.user.termsLanguage || "he";
      const userPrivacyLang = req.user.privacyLanguage || "he";

      const [activeTerms, activePrivacy] = await Promise.all([
        LegalDocument.getActiveDocument("terms", userTermsLang),
        LegalDocument.getActiveDocument("privacy", userPrivacyLang),
      ]);

      return res.status(403).json({
        ok: false,
        error: "CONSENT_REQUIRED",
        message: "You must accept the updated legal documents to continue",
        requiredDocuments: {
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
    }

    // User doesn't need consent update, continue
    next();
  } catch (error) {
    console.error("checkLegalConsent middleware error:", error);
    // Don't block the request if there's an error checking consent
    // Just log it and continue
    next();
  }
};

module.exports = { checkLegalConsent };

