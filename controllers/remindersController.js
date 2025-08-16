const {
  Reminder,
  reminderCreate,
  reminderUpdate,
  reminderListQuery,
} = require("../models/ReminderModel");

const getAllReminders = async (req, res, next) => {
  try {
    const petIdFromParam = req.params.petId;
    const { error, value } = reminderListQuery.validate(
      { ...req.query, petId: req.query.petId || petIdFromParam },
      { abortEarly: false, stripUnknown: true, convert: true }
    );
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const { petId, onlyUpcoming, sort, order, limit } = value;

    const q = { userId: req.user.id };
    if (petId) q.petId = petId;
    if (onlyUpcoming) q.date = { $gte: new Date() };

    const sortField = sort || "date";
    const sortOrder = order === "desc" ? -1 : 1;

    let cursor = Reminder.find(q).sort({ [sortField]: sortOrder, _id: 1 });
    if (limit) cursor = cursor.limit(limit);

    const reminders = await cursor.lean();
    res.status(200).json({ reminders });
  } catch (err) {
    const e = new Error("An error occurred while fetching reminders.");
    e.statusCode = 500;
    next(e);
  }
};

const addReminder = async (req, res, next) => {
  try {
    if (req.params.petId && !req.body.petId) req.body.petId = req.params.petId;

    const { error, value } = reminderCreate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const doc = await Reminder.create({ ...value, userId: req.user.id });
    res
      .status(201)
      .json({ message: "Reminder added successfully", reminder: doc });
  } catch (err) {
    const e = new Error("An error occurred while adding the reminder.");
    e.statusCode = 500;
    next(e);
  }
};

const updateReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;
    if (!reminderId) {
      const e = new Error("Reminder ID is required");
      e.statusCode = 400;
      return next(e);
    }

    const { error, value } = reminderUpdate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const updated = await Reminder.findOneAndUpdate(
      { _id: reminderId, userId: req.user.id },
      value,
      { new: true }
    );
    if (!updated) {
      const e = new Error("Reminder not found");
      e.statusCode = 404;
      return next(e);
    }

    res
      .status(200)
      .json({ message: "Reminder updated successfully", reminder: updated });
  } catch (err) {
    const e = new Error("An error occurred while updating the reminder.");
    e.statusCode = 500;
    next(e);
  }
};

const deleteReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;
    const deleted = await Reminder.findOneAndDelete({
      _id: reminderId,
      userId: req.user.id,
    });
    if (!deleted) {
      const e = new Error("Reminder not found");
      e.statusCode = 404;
      return next(e);
    }
    res.status(200).json({ message: "Reminder deleted successfully" });
  } catch (err) {
    const e = new Error("An error occurred while deleting the reminder.");
    e.statusCode = 500;
    next(e);
  }
};

const completeReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;
    const updated = await Reminder.findOneAndUpdate(
      { _id: reminderId, userId: req.user.id },
      { isCompleted: true },
      { new: true }
    );
    if (!updated) {
      const e = new Error("Reminder not found");
      e.statusCode = 404;
      return next(e);
    }
    res
      .status(200)
      .json({ message: "Reminder marked as completed", reminder: updated });
  } catch (err) {
    const e = new Error("An error occurred while completing the reminder.");
    e.statusCode = 500;
    next(e);
  }
};

module.exports = {
  getAllReminders,
  addReminder,
  updateReminder,
  deleteReminder,
  completeReminder,
};
