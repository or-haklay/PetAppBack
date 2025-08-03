const mongoose = require("mongoose");
const Joi = require("joi");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },

    password: { type: String },

    googleId: { type: String },
    facebookId: { type: String },

    subscriptionPlan: {
      type: String,
      enum: ["free", "premium", "gold"],
      default: "free",
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },

    isAdmin: { type: Boolean, default: false },

    bio: { type: String },
    address: {
      street: String,
      city: String,
      country: String,
      houseNumber: Number,
      zipCode: Number,
    },
    profilePicture: { type: String },
    dateOfBirth: { type: Date },

    lastActive: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

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

userSchema.methods.isActiveSubscriber = function () {
  return (
    this.subscriptionPlan !== "free" &&
    this.subscriptionExpiresAt &&
    this.subscriptionExpiresAt > new Date()
  );
};

const User = mongoose.model("User", userSchema, "users");

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  country: Joi.string().required(),
  houseNumber: Joi.number(),
  zipCode: Joi.number(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2),
  phone: Joi.string()
    .pattern(/^\+?[0-9]{7,15}$/)
    .allow(null, ""),
  bio: Joi.string().allow(null, ""),
  address: addressSchema.allow(null, ""),
  profilePicture: Joi.string().uri().allow(null, ""), // מוודא שזה קישור תקין
  dateOfBirth: Joi.date().allow(null),
});

const registerWithPasswordSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Password must be at least 8 characters and include uppercase, lowercase and a number.",
      "any.required": "Password is required",
    }),
});
const registerWithSocialSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  googleId: Joi.string(),
  facebookId: Joi.string(),
}).or("googleId", "facebookId");

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

module.exports = {
  User,
  registerWithPasswordSchema,
  loginSchema,
  updateProfileSchema,
  registerWithSocialSchema,
};
