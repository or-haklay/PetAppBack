const mongoose = require("mongoose");
const Joi = require("joi");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },

  password: { type: String },

  googleId: { type: String },
  facebookId: { type: String },

  isGold: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },

  bio: { type: String },
  address: { type: String },
  profilePicture: { type: String },
  dateOfBirth: { type: Date },

  lastActive: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  if (!this.password) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model("User", userSchema, "users");

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  country: Joi.string().required(),
  houseNumber: Joi.string(),
  zipCode: Joi.string(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2),
  phone: Joi.string().allow(null, ""), // מאפשר גם ערך ריק או null
  bio: Joi.string().allow(null, ""),
  address: addressSchema.allow(null, ""),
  profilePicture: Joi.string().uri().allow(null, ""), // מוודא שזה קישור תקין
  dateOfBirth: Joi.date().allow(null),
});

const registerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"))
    .required()
    .messages({
      "string.pattern.base":
        "Password must be at least 8 characters and include uppercase, lowercase and a number.",
      "any.required": "Password is required",
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

module.exports = { User, registerSchema, loginSchema, updateProfileSchema };
