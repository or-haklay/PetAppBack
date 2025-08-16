const mongoose = require("mongoose");
const Joi = require("joi");

const petSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    species: { type: String, required: true }, // dog/cat/...
    breed: String,
    sex: {
      type: String,
      enum: ["male", "female", "unknown"],
      default: "unknown",
    },
    weightKg: Number,
    color: String,
    chipNumber: String,
    notes: String,
    birthDate: { type: Date },
    profilePictureUrl: { type: String },
  },
  {
    timestamps: true,
  }
);

const Pet = mongoose.model("Pet", petSchema, "pets");

const createPetSchema = Joi.object({
  name: Joi.string().min(2).required(),
  type: Joi.string().required(),
  birthDate: Joi.date(),
  profilePictureUrl: Joi.string().uri(),
});

const updatePetSchema = Joi.object({
  name: Joi.string().min(2),
  type: Joi.string(),
  birthDate: Joi.date(),
  profilePictureUrl: Joi.string().uri(),
});

const addExpenseSchema = Joi.object({
  description: Joi.string().min(2).max(100).required().messages({
    "string.base": "Description must be a string",
    "string.min": "Description must be at least 2 characters",
    "string.max": "Description must not exceed 100 characters",
    "any.required": "Description is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.base": "Amount must be a number",
    "number.positive": "Amount must be greater than 0",
    "any.required": "Amount is required",
  }),
  date: Joi.date().max("now").required().messages({
    "date.base": "Date must be valid",
    "date.max": "Date cannot be in the future",
    "any.required": "Date is required",
  }),
  category: Joi.string()
    .valid("Vet", "Food", "Grooming", "Toys", "Insurance", "Other")
    .required()
    .messages({
      "any.only":
        "Category must be one of: Vet, Food, Grooming, Toys, Insurance, Other",
      "any.required": "Category is required",
    }),
});

const addReminderSchema = Joi.object({
  title: Joi.string().min(2).max(100).required().messages({
    "string.base": "Reminder title must be a string",
    "string.empty": "Reminder title cannot be empty",
    "string.min": "Reminder title must be at least 2 characters",
    "string.max": "Reminder title must not exceed 100 characters",
    "any.required": "Reminder title is required",
  }),
  date: Joi.date().min("now").required().messages({
    "date.base": "Reminder date must be a valid date",
    "date.min": "Reminder date must be in the future",
    "any.required": "Reminder date is required",
  }),
  description: Joi.string().max(500).optional().messages({
    "string.base": "Description must be a string",
    "string.max": "Description must not exceed 500 characters",
  }),
  time: Joi.string().optional().messages({
    "string.base": "Time must be a string",
  }),
  repeatInterval: Joi.string()
    .valid("none", "daily", "weekly", "monthly", "yearly")
    .optional(),
});

const addMedicalRecordSchema = Joi.object({
  recordName: Joi.string().min(2).max(100).required().messages({
    "string.base": "Record name must be a string",
    "string.min": "Record name must be at least 2 characters",
    "string.max": "Record name must not exceed 100 characters",
    "any.required": "Record name is required",
  }),
  recordType: Joi.string()
    .valid(
      "Vaccination",
      "Surgery",
      "Checkup",
      "Treatment",
      "Diagnosis",
      "Other"
    )
    .required()
    .messages({
      "any.only":
        "Record type must be one of: Vaccination, Surgery, Checkup, Treatment, Diagnosis, Other",
      "any.required": "Record type is required",
    }),
  date: Joi.date().max("now").required().messages({
    "date.base": "Date must be valid",
    "date.max": "Date cannot be in the future",
    "any.required": "Date is required",
  }),
  fileUrl: Joi.string().uri().messages({
    "string.uri": "File URL must be a valid URI",
  }),
  description: Joi.string().max(500).optional().messages({
    "string.base": "Description must be a string",
    "string.max": "Description must not exceed 500 characters",
  }),
  veterinarianName: Joi.string().min(2).max(100).messages({
    "string.base": "Veterinarian name must be a string",
    "string.min": "Veterinarian name must be at least 2 characters",
    "string.max": "Veterinarian name must not exceed 100 characters",
  }),
});

module.exports = {
  Pet,
  createPetSchema,
  updatePetSchema,
  addExpenseSchema,
  addReminderSchema,
  addMedicalRecordSchema,
};
