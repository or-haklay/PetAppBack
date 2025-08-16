const mongoose = require("mongoose");
const Joi = require("joi");

const medicalRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    petId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true,
    },
    recordName: { type: String, required: true },
    recordType: { type: String, required: true }, // vaccine/checkup/lab/surgery/doc...
    date: { type: Date, required: true },
    fileUrl: { type: String },
    fileMime: { type: String },
    description: { type: String },
    veterinarianName: { type: String },
    clinic: { type: String },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ userId: 1, petId: 1, date: -1 });

const MedicalRecord = mongoose.model(
  "MedicalRecord",
  medicalRecordSchema,
  "medical_records"
);

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const medicalCreate = Joi.object({
  petId: objectId.required(),
  recordName: Joi.string().min(1).required(),
  recordType: Joi.string().min(1).required(),
  date: Joi.date().iso().required(),
  fileUrl: Joi.string().uri(),
  fileMime: Joi.string(),
  description: Joi.string().allow(""),
  veterinarianName: Joi.string().allow(""),
  clinic: Joi.string().allow(""),
});

const medicalUpdate = medicalCreate.min(1);

const medicalListQuery = Joi.object({
  petId: objectId,
  from: Joi.date().iso(),
  to: Joi.date().iso().greater(Joi.ref("from")).messages({
    "date.greater": '"to" חייב להיות אחרי "from"',
  }),
  sort: Joi.string().valid("date", "recordType", "recordName"),
  order: Joi.string().valid("asc", "desc").default("desc"),
  limit: Joi.number().integer().min(1).max(200),
});

module.exports = {
  MedicalRecord,
  medicalCreate,
  medicalUpdate,
  medicalListQuery,
};
