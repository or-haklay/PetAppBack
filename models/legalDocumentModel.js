const mongoose = require("mongoose");

const legalDocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["terms", "privacy"],
      required: true,
    },
    language: {
      type: String,
      enum: ["he", "en"],
      required: true,
    },
    version: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
    },
    changesSummary: {
      he: { type: String, default: "" },
      en: { type: String, default: "" },
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
legalDocumentSchema.index({ type: 1, language: 1, version: 1 }, { unique: true });
legalDocumentSchema.index({ type: 1, language: 1, isActive: 1 });

// Static method to generate version number
legalDocumentSchema.statics.generateVersion = async function (type, language) {
  const latestDoc = await this.findOne({ type, language })
    .sort({ createdAt: -1 })
    .select("version");

  if (!latestDoc) {
    return "1.0";
  }

  // Parse version (e.g., "1.0" -> [1, 0])
  const parts = latestDoc.version.split(".").map(Number);
  const major = parts[0] || 1;
  const minor = parts[1] || 0;

  // Increment minor version
  return `${major}.${minor + 1}`;
};

// Static method to deactivate previous versions
legalDocumentSchema.statics.deactivatePrevious = async function (type, language) {
  await this.updateMany(
    { type, language, isActive: true },
    { $set: { isActive: false } }
  );
};

// Static method to get active document
legalDocumentSchema.statics.getActiveDocument = async function (type, language) {
  return await this.findOne({ type, language, isActive: true })
    .populate("uploadedBy", "name email")
    .sort({ effectiveFrom: -1 });
};

const LegalDocument = mongoose.model(
  "LegalDocument",
  legalDocumentSchema,
  "legalDocuments"
);

module.exports = { LegalDocument };

