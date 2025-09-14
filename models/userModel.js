const mongoose = require("mongoose");
const Joi = require("joi");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },

    password: { type: String, select: false },

    googleId: { type: String },
    facebookId: { type: String },

    // Terms and Privacy Policy consent
    termsAccepted: {
      type: Boolean,
      required: true,
      default: false,
    },
    privacyAccepted: {
      type: Boolean,
      required: true,
      default: false,
    },
    consentTimestamp: {
      type: Date,
      default: null,
    },
    consentVersion: {
      type: String,
      default: "1.0",
    },
    // Points system
    points: { type: Number, default: 0 }, // נקודות מצטברות לשימוש
    coins: { type: Number, default: 0 }, // מטבעות לרכישות
    dailyStreak: { type: Number, default: 0 }, // רצף ימים
    lastDailyAt: { type: Date, default: null }, // מתי עודכן/נוצר יום אחרון

    // Google Calendar integration
    googleCalendarAccessToken: { type: String }, // Access token ליומן
    googleCalendarRefreshToken: { type: String }, // Refresh token ליומן
    googleCalendarTokenExpiry: { type: Date }, // מתי הטוקן פג תוקף
    googleCalendarEnabled: { type: Boolean, default: false }, // האם יומן גוגל מופעל

    // Push Notifications
    pushToken: { type: String }, // Expo push token להתראות
    pushNotificationsEnabled: { type: Boolean, default: true }, // האם התראות מופעלות

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

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ facebookId: 1 });
userSchema.index({ subscriptionPlan: 1, subscriptionExpiresAt: 1 });

// Virtual properties
userSchema.virtual("fullAddress").get(function () {
  if (!this.address) return null;

  const parts = [];
  if (this.address.street) parts.push(this.address.street);
  if (this.address.houseNumber) parts.push(this.address.houseNumber.toString());
  if (this.address.city) parts.push(this.address.city);
  if (this.address.zipCode) parts.push(this.address.zipCode.toString());
  if (this.address.country) parts.push(this.address.country);

  return parts.length > 0 ? parts.join(", ") : null;
});

userSchema.virtual("subscriptionStatus").get(function () {
  if (this.subscriptionPlan === "free") return "free";
  if (!this.subscriptionExpiresAt) return "unknown";

  const now = new Date();
  const expiry = new Date(this.subscriptionExpiresAt);

  if (expiry > now) {
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) return "expiring_soon";
    return "active";
  }

  return "expired";
});

userSchema.pre("save", async function (next) {
  try {
    // אם הסיסמה לא השתנתה, לא צריך לעשות כלום
    if (!this.isModified("password")) {
      return next();
    }

    // אם אין סיסמה (למשל בהרשמה חברתית), לא צריך להצפין
    if (!this.password || this.password.trim() === "") {
      return next();
    }

    // הצפנת הסיסמה
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    console.error("Error in password hashing:", error);
    next(error);
  }
});

userSchema.methods.isActiveSubscriber = function () {
  return (
    this.subscriptionPlan !== "free" &&
    this.subscriptionExpiresAt &&
    this.subscriptionExpiresAt > new Date()
  );
};

userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // אם אין סיסמה מוצפנת, לא ניתן להשוות
    if (!this.password) {
      return false;
    }

    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
};

userSchema.methods.updatePassword = async function (newPassword) {
  try {
    if (!newPassword || newPassword.trim() === "") {
      throw new Error("New password cannot be empty");
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(newPassword, salt);

    return this.save();
  } catch (error) {
    console.error("Error updating password:", error);
    throw error;
  }
};

userSchema.methods.isSocialUser = function () {
  return !!(this.googleId || this.facebookId);
};

userSchema.methods.hasPassword = function () {
  return !!(this.password && this.password.trim() !== "");
};

userSchema.methods.isPremiumUser = function () {
  return (
    this.subscriptionPlan === "premium" || this.subscriptionPlan === "gold"
  );
};

// Static methods
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByGoogleId = function (googleId) {
  return this.findOne({ googleId });
};

userSchema.statics.findByFacebookId = function (facebookId) {
  return this.findOne({ facebookId });
};

userSchema.statics.findPremiumUsers = function () {
  return this.find({
    subscriptionPlan: { $in: ["premium", "gold"] },
    subscriptionExpiresAt: { $gt: new Date() },
  });
};

userSchema.methods.updateLastActive = function () {
  this.lastActive = new Date();
  return this.save();
};

userSchema.methods.canAccessFeature = function (featureName) {
  const featurePermissions = {
    advanced_chat: ["premium", "gold"],
    unlimited_pets: ["premium", "gold"],
    priority_support: ["gold"],
    custom_themes: ["premium", "gold"],
    export_data: ["premium", "gold"],
  };

  const requiredPlan = featurePermissions[featureName];
  if (!requiredPlan) return false;

  return (
    requiredPlan.includes(this.subscriptionPlan) && this.isActiveSubscriber()
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
  profilePicture: Joi.string().uri().allow(null, ""),
  dateOfBirth: Joi.date().allow(null),
});

const registerWithPasswordSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 50 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Password must be at least 8 characters and include uppercase, lowercase and a number.",
      "any.required": "Password is required",
    }),
  termsAccepted: Joi.boolean().valid(true).required().messages({
    "any.only": "You must accept the terms of service",
    "any.required": "Terms acceptance is required",
  }),
  privacyAccepted: Joi.boolean().valid(true).required().messages({
    "any.only": "You must accept the privacy policy",
    "any.required": "Privacy policy acceptance is required",
  }),
});

const registerWithSocialSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 50 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  googleId: Joi.string().allow(null, ""),
  facebookId: Joi.string().allow(null, ""),
})
  .or("googleId", "facebookId")
  .messages({
    "object.missing":
      "Either Google ID or Facebook ID is required for social registration",
  });

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      "string.pattern.base":
        "New password must be at least 8 characters and include uppercase, lowercase and a number.",
      "any.required": "New password is required",
    }),
});
module.exports = {
  User,
  registerWithPasswordSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  registerWithSocialSchema,
};
