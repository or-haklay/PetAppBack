const mongoose = require("mongoose");
const Joi = require("joi");

const expenseSchema = mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  category: {
    type: String,
    enum: ["Vet", "Food", "Grooming", "Toys", "Insurance", "Other"],
  },
});

const reminderSchema = mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  isCompleted: { type: Boolean, default: false },
  repeatInterval: {
    type: String,
    enum: ["none", "daily", "weekly", "monthly", "yearly"],
    default: "none",
  },
});

const medicalRecordSchema = mongoose.Schema({
  recordName: { type: String, required: true },
  recordType: { type: String, required: true },
  date: { type: Date, required: true },
  fileUrl: { type: String, required: true },
  description: { type: String },
  veterinarianName: { type: String },
});

const petSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    type: { type: String, required: true },
    birthDate: { type: Date },
    profilePictureUrl: { type: String },

    expenses: [expenseSchema],

    reminders: [reminderSchema],

    medicalRecords: [medicalRecordSchema],
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
  fileUrl: Joi.string().uri().required().messages({
    "string.uri": "File URL must be a valid URI",
    "any.required": "File URL is required",
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
