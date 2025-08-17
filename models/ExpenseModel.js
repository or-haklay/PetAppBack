const Joi = require("joi");
const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
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
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    category: {
      type: String,
      enum: ["Vet", "Food", "Grooming", "Toys", "Insurance", "Other"],
      required: true,
    },
    currency: { type: String, default: "ILS" },
    vendor: String,
  },
  { timestamps: true }
);

expenseSchema.index({ userId: 1, petId: 1, date: -1 });

const Expense = mongoose.model("Expense", expenseSchema, "expenses");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .optional();

const expenseCreate = Joi.object({
  petId: objectId.required(), // שינוי: חובה לציין petId
  description: Joi.string().min(1).required(),
  amount: Joi.number().min(0).required(),
  date: Joi.date().iso().required(),
  category: Joi.string()
    .valid("Vet", "Food", "Grooming", "Toys", "Insurance", "Other")
    .required(),
  currency: Joi.string().default("ILS"),
  vendor: Joi.string().allow(""),
});

const expenseUpdate = expenseCreate.min(1);

const listQuerySchema = Joi.object({}).unknown(true); // מאפשר כל ערך - בלי validation

module.exports = { expenseCreate, expenseUpdate, Expense, listQuerySchema };
