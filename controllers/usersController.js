const {
  User,
  registerSchema,
  loginSchema,
  updateProfileSchema,
} = require("../models/userModel"); // Assuming you have a User model defined
const _ = require("lodash");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
    const safeUsers = _.map(users, (user) => {
      return _.pick(user, [
        "_id",
        "name",
        "email",
        "phone",
        "isGold",
        "profilePicture",
        "dateOfBirth",
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

const createUser = async (req, res, next) => {
  try {
    const newUser = req.body;
    // request validation
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
    // system validation
    const existingUser = await User.findOne({ email: newUser.email });
    if (existingUser) {
      const validationError = new Error("Email already exists");
      validationError.statusCode = 409;
      return next(validationError);
    }
    // process
    const user = new User(newUser);

    const savedUser = await user.save();
    res.status(201).send({ message: "User created", user: savedUser });
  } catch (error) {
    console.error("Error saving user:", error);
    const dbError = new Error("Database error occurred while creating user");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const loginUser = async (req, res, next) => {
  try {
    // request validation
    const { error } = loginSchema.validate(req.body);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }
    // system validation
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      const validationError = new Error("Invalid email or password");
      validationError.statusCode = 401;
      return next(validationError);
    }
    //compare password
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!validPassword) {
      const validationError = new Error("Invalid email or password");
      validationError.statusCode = 401;
      return next(validationError);
    }
    //process
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

    // response
    res.send({
      message: "User logged in successfully",
      token: token,
      user: _.pick(user, ["_id", "name", "email", "phone", "isGold"]),
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
    const user = await User.findById(req.user.userId).lean();
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
        "profilePicture",
        "subscriptionPlan",
        "subscriptionExpiresAt",
      ]),
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    const dbError = new Error("Database error occurred while fetching user");
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
};
