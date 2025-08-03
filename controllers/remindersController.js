const { Pet, addReminderSchema } = require("../models/petModel"); // Assuming you have a Pet model defined
const _ = require("lodash");

const addReminder = async (req, res, next) => {
  try {
    // request validation
    const { error } = addReminderSchema.validate(req.body);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }
    //process
    const newReminder = {
      ...req.body,
      date: new Date(req.body.date),
    };
    req.pet.reminders.push(newReminder);
    await Pet.updateOne({ _id: req.pet._id }, { reminders: req.pet.reminders });
    res.status(201).json({
      message: "Reminder added successfully",
      reminder: newReminder,
    });
  } catch (error) {
    const systemError = new Error(
      "An error occurred while adding the reminder."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

const getAllReminders = async (req, res, next) => {
  try {
    if (req.query.sort) {
      const sortField = req.query.sort;
      req.pet.reminders = _.orderBy(req.pet.reminders, [sortField], ["asc"]);
    }
    if (req.query.limit) {
      const limit = parseInt(req.query.limit, 10);
      req.pet.reminders = req.pet.reminders.slice(0, limit);
    }

    //process
    res.status(200).json({
      reminders: req.pet.reminders,
    });
  } catch (error) {
    const systemError = new Error(
      "An error occurred while fetching reminders."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

const getReminderById = async (req, res, next) => {
  try {
    //process
    const reminder = req.pet.reminders.find(
      (reminder) => reminder._id.toString() === req.params.reminderId
    );
    if (!reminder) {
      const systemError = new Error("Reminder not found.");
      systemError.statusCode = 404;
      return next(systemError);
    }
    res.status(200).json({
      reminder,
    });
  } catch (error) {
    const systemError = new Error(
      "An error occurred while fetching the reminder."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

const changeReminderStatus = async (req, res, next) => {
  try {
    //process
    const reminder = req.pet.reminders.find(
      (reminder) => reminder._id.toString() === req.params.reminderId
    );
    if (!reminder) {
      const systemError = new Error("Reminder not found.");
      systemError.statusCode = 404;
      return next(systemError);
    }
    reminder.isCompleted = !reminder.isCompleted;
    await Pet.updateOne({ _id: req.pet._id }, { reminders: req.pet.reminders });
    res.status(200).json({
      message: "Reminder status changed successfully",
      reminder,
    });
  } catch (error) {
    const systemError = new Error(
      "An error occurred while changing the reminder status."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

const updateReminder = async (req, res, next) => {
  try {
    const reminderIndex = req.pet.reminders.findIndex(
      (reminder) => reminder._id.toString() === req.params.reminderId
    );
    if (reminderIndex === -1) {
      const systemError = new Error("Reminder not found.");
      systemError.statusCode = 404;
      return next(systemError);
    }
    // process
    req.pet.reminders[reminderIndex] = {
      ...req.pet.reminders[reminderIndex],
      ...req.body,
    };
    req.pet.reminders[reminderIndex].date = new Date(req.body.date);
    const safeReminder = _.pick(req.pet.reminders[reminderIndex], [
      "title",
      "description",
      "date",
      "time",
      "repeatInterval",
    ]);
    // validate input
    const { error } = addReminderSchema.validate(safeReminder);
    if (error) {
      const validationError = new Error(
        "validation failed: " + error.details[0].message
      );
      validationError.statusCode = 400;
      return next(validationError);
    }

    await Pet.updateOne({ _id: req.pet._id }, { reminders: req.pet.reminders });
    res.status(200).json({
      message: "Reminder updated successfully",
      reminder: req.pet.reminders[reminderIndex],
    });
  } catch (error) {
    const systemError = new Error(
      "An error occurred while updating the reminder."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

const deleteReminder = async (req, res, next) => {
  try {
    //process
    const reminderIndex = req.pet.reminders.findIndex(
      (reminder) => reminder._id.toString() === req.params.reminderId
    );
    if (reminderIndex === -1) {
      const systemError = new Error("Reminder not found.");
      systemError.statusCode = 404;
      return next(systemError);
    }
    req.pet.reminders.splice(reminderIndex, 1);
    await Pet.updateOne({ _id: req.pet._id }, { reminders: req.pet.reminders });
    res.status(200).json({
      message: "Reminder deleted successfully",
    });
  } catch (error) {
    const systemError = new Error(
      "An error occurred while deleting the reminder."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

module.exports = {
  addReminder,
  getAllReminders,
  getReminderById,
  changeReminderStatus,
  updateReminder,
  deleteReminder,
};
