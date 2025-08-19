const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const _ = require("lodash");
const {
  User,
  registerWithPasswordSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  registerWithSocialSchema,
} = require("../models/userModel");

const getAllUsers = async (req, res, next) => {
  try {
    // request validation
    if (!req.user || !req.user.isAdmin) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 403;
      return next(validationError);
    }

    if (req.query.limit && isNaN(req.query.limit)) {
      const validationError = new Error("Limit must be a number");
      validationError.statusCode = 400;
      return next(validationError);
    }

    if (req.query.sort && !["name", "email"].includes(req.query.sort)) {
      const validationError = new Error("Invalid sort field");
      validationError.statusCode = 400;
      return next(validationError);
    }
    // process
    const users = await User.find({}, null, {
      limit: req.query.limit,
      sort: { [req.query.sort]: 1 },
    }).lean();
    // בתוך getAllUsers, בזמן ה-map:
    const safeUsers = _.map(users, (user) => {
      return _.pick(user, [
        "_id",
        "name",
        "email",
        "phone",
        "profilePicture",
        "dateOfBirth",
        "subscriptionPlan",
        "subscriptionExpiresAt",
        "isAdmin",
        "lastActive",
        "createdAt",
      ]);
    });

    // response
    res.json({
      message: `Get all users ${
        req.query.limit ? `with limit ${req.query.limit}` : "without limit"
      }`,
      users: safeUsers,
    });
  } catch (error) {
    const dbError = new Error("Database error occurred while fetching users");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const getUserById = async (req, res, next) => {
  // request validation
  if (req.params.id.length !== 24) {
    const validationError = new Error("Invalid User ID format");
    validationError.statusCode = 400;
    return next(validationError);
  }
  if (!req.user || (req.user._id !== req.params.id && !req.user.isAdmin)) {
    const validationError = new Error("Unauthorized access");
    validationError.statusCode = 403;
    return next(validationError);
  }
  //system validation
  const user = await User.findOne({ _id: req.params.id }).lean();

  if (!user) {
    const validationError = new Error("User not found");
    validationError.statusCode = 404;
    return next(validationError);
  }
  // process
  const selectedUserDetails = _.pick(user, [
    "_id",
    "name",
    "email",
    "phone",
    "isGold",
    "bio",
    "address",
    "profilePicture",
    "dateOfBirth",
  ]);

  //response
  res.json({ message: "Get user by ID", user: selectedUserDetails });
};

const SALT_ROUNDS = 10;

const createUser = async (req, res, next) => {
  try {
    const newUser = { ...req.body };

    const { error } = newUser.password
      ? registerWithPasswordSchema.validate(newUser)
      : registerWithSocialSchema.validate(newUser);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }

    if (!newUser.password && !newUser.googleId && !newUser.facebookId) {
      const validationError = new Error(
        "Password or social login ID is required"
      );
      validationError.statusCode = 400;
      return next(validationError);
    }

    // normalize email
    if (newUser.email) newUser.email = String(newUser.email).toLowerCase();

    // unique email
    const existingUser = await User.findOne({ email: newUser.email });
    if (existingUser) {
      const validationError = new Error("Email already exists");
      validationError.statusCode = 409;
      return next(validationError);
    }

    // Password will be hashed automatically by the pre-save hook in the model

    const user = new User(newUser);
    const savedUser = await user.save();
    const token = jwt.sign(
      {
        _id: savedUser._id,
        isAdmin: savedUser.isAdmin,
        name: savedUser.name,
        email: savedUser.email,
      },
      process.env.JWT_KEY,
      { expiresIn: "7d" }
    );
    res.status(201).send({
      message: "User created",
      token,
      user: _.pick(savedUser, [
        "_id",
        "name",
        "email",
        "phone",
        "profilePicture",
        "subscriptionPlan",
      ]),
    });
  } catch (error) {
    console.error("Error saving user:", error);
    const dbError = new Error("Database error occurred while creating user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }

    // אם בסכימה של User השדה password הוא select:false — חייבים לבחור אותו ידנית
    const user = await User.findOne({
      email: String(req.body.email).toLowerCase(),
    }).select("+password");
    if (!user) {
      const validationError = new Error("Invalid email or password");
      validationError.statusCode = 401;
      return next(validationError);
    }

    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password || ""
    );
    if (!validPassword) {
      const validationError = new Error("Invalid email or password");
      validationError.statusCode = 401;
      return next(validationError);
    }

    // עדכון פעילות אחרונה (לא חובה await)
    user.lastActive = new Date();
    await user.save();

    const token = jwt.sign(
      {
        _id: user._id,
        isAdmin: user.isAdmin,
        subscriptionPlan: user.subscriptionPlan,
        name: user.name,
        email: user.email,
      },
      process.env.JWT_KEY,
      { expiresIn: "7d" }
    );

    res.send({
      message: "User logged in successfully",
      token,
      user: _.pick(user, [
        "_id",
        "name",
        "email",
        "phone",
        "profilePicture",
        "subscriptionPlan",
      ]),
    });
  } catch (error) {
    console.error("Error during user login:", error);
    const dbError = new Error("Database error occurred during user login");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const updateUser = async (req, res, next) => {
  try {
    // request validation
    const { error } = updateProfileSchema.validate(req.body);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }
    if (req.user._id !== req.params.id && !req.user.isAdmin) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 403;
      return next(validationError);
    }
    // system validation
    const user = await User.findOne({ _id: req.params.id });

    if (!user) {
      const validationError = new Error("User not found");
      validationError.statusCode = 404;
      return next(validationError);
    }
    // process
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updatedUser) {
      const dbError = new Error("Database error occurred while updating user");
      dbError.statusCode = 500;
      return next(dbError);
    }
    // response
    res.send({ message: "User updated", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    const dbError = new Error("Database error occurred while updating user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    // request validation
    if (!req.user || (req.user._id !== req.params.id && !req.user.isAdmin)) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 403;
      return next(validationError);
    }
    // process
    const userId = req.params.id;
    const deletedUser = await User.findByIdAndDelete(userId);
    // system validation
    if (!deletedUser) {
      const validationError = new Error("User not found");
      validationError.statusCode = 404;
      return next(validationError);
    }
    // response
    res.send({ message: `User with ID ${userId} deleted` });
  } catch (error) {
    console.error("Error deleting user:", error);
    const dbError = new Error("Database error occurred while deleting user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user?._id; // חשוב: ה-MW צריך לשים כאן _id מתוך ה-JWT
    if (!userId) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 401;
      return next(validationError);
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      const validationError = new Error("User not found");
      validationError.statusCode = 404;
      return next(validationError);
    }

    res.json({
      user: _.pick(user, [
        "_id",
        "name",
        "email",
        "phone",
        "bio",
        "address",
        "profilePicture",
        "dateOfBirth",
        "subscriptionPlan",
        "subscriptionExpiresAt",
        "isAdmin",
        "lastActive",
        "createdAt",
        "updatedAt",
      ]),
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    const dbError = new Error("Database error occurred while fetching user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 401;
      return next(validationError);
    }

    // ולא מאפשרים כאן שדות רגישים כמו isAdmin/subscriptionPlan וכד'
    const allowed = _.pick(req.body, [
      "name",
      "email",
      "phone",
      "bio",
      "profilePicture",
      "dateOfBirth",
      "address.street",
      "address.city",
      "address.country",
      "address.houseNumber",
      "address.zipCode",
    ]);

    // אם אימייל — נרמול
    if (allowed.email) allowed.email = String(allowed.email).toLowerCase();

    // ולידציה עם הסכימה שלך
    const { error } = updateProfileSchema.validate(req.body);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: allowed },
      { new: true }
    ).lean();

    if (!updatedUser) {
      const dbError = new Error("Database error occurred while updating user");
      dbError.statusCode = 500;
      return next(dbError);
    }

    res.send({
      message: "User updated",
      user: _.pick(updatedUser, [
        "_id",
        "name",
        "email",
        "phone",
        "bio",
        "address",
        "profilePicture",
        "dateOfBirth",
        "subscriptionPlan",
        "subscriptionExpiresAt",
        "isAdmin",
        "lastActive",
        "createdAt",
        "updatedAt",
      ]),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    const dbError = new Error("Database error occurred while updating user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 401;
      return next(validationError);
    }

    const { error } = changePasswordSchema.validate(req.body);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      const validationError = new Error("User not found");
      validationError.statusCode = 404;
      return next(validationError);
    }

    const ok = await bcrypt.compare(
      req.body.currentPassword,
      user.password || ""
    );
    if (!ok) {
      const validationError = new Error("Current password is incorrect");
      validationError.statusCode = 401;
      return next(validationError);
    }

    user.password = req.body.newPassword;
    await user.save();

    res.send({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    const dbError = new Error(
      "Database error occurred while changing password"
    );
    dbError.statusCode = 500;
    return next(dbError);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  loginUser,
  getCurrentUser,
  updateMe,
  changePassword,
};
