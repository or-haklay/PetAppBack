const { Pet, addExpenseSchema } = require("../models/petModel"); // Assuming you have a Pet model defined
const _ = require("lodash");

const getAllExpenses = async (req, res, next) => {
  try {
    //process
    if (req.query && req.query.sort) {
      if (!["date", "amount", "category"].includes(req.query.sort)) {
        const validationError = new Error("Invalid sort field");
        validationError.statusCode = 400;
        return next(validationError);
      }
    }
    if (req.query && req.query.limit && isNaN(req.query.limit)) {
      const validationError = new Error("Limit must be a number");
      validationError.statusCode = 400;
      return next(validationError);
    }

    let expenses = req.pet.expenses;

    if (req.query.sort) {
      const sortField = req.query.sort;
      expenses.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1;
        if (a[sortField] > b[sortField]) return 1;
        return 0;
      });
    } else {
      expenses.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    if (req.query.limit) {
      expenses = expenses.slice(0, parseInt(req.query.limit));
    }

    res.status(200).json({
      expenses,
    });
  } catch (error) {
    const systemError = new Error("An error occurred while fetching expenses.");
    systemError.statusCode = 500;
    return next(systemError);
  }
};

const addExpense = async (req, res, next) => {
  try {
    // request validation
    const { error } = addExpenseSchema.validate(req.body);
    if (error) {
      error.statusCode = 400;
      return next(error);
    }
    // Add expense to pet
    const expense = {
      description: req.body.description,
      amount: req.body.amount,
      date: req.body.date,
      category: req.body.category,
    };
    req.pet.expenses.push(expense);
    await req.pet.save();

    console.log("Expense added:", expense);

    res.status(201).json({
      message: "Expense added successfully",
      expense,
    });
  } catch (error) {
    const systemError = new Error(
      "An error occurred while adding the expense."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const { id: petId, expenseId } = req.params;
    if (!expenseId) {
      const error = new Error("Expense ID is required");
      error.statusCode = 400;
      return next(error);
    }

    const expenseIndex = req.pet.expenses.findIndex(
      (expense) => expense._id.toString() === expenseId
    );
    if (expenseIndex === -1) {
      const error = new Error("Expense not found");
      error.statusCode = 404;
      return next(error);
    }

    // validate input
    const { error } = addExpenseSchema.validate(req.body);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }

    req.pet.expenses[expenseIndex] = {
      ...req.pet.expenses[expenseIndex].toObject(),
      ...req.body,
    };

    await req.pet.save();
    res.status(200).json({
      message: "Expense updated successfully",
      expense: req.pet.expenses[expenseIndex],
    });
  } catch (error) {
    console.error("Error updating expense:", error);
    const systemError = new Error(
      "An error occurred while updating the expense."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const { id: expenseId } = req.params;

    const expenseIndex = req.pet.expenses.findIndex(
      (expense) => expense._id.toString() === expenseId
    );
    if (expenseIndex === -1) {
      const error = new Error("Expense not found");
      error.statusCode = 404;
      return next(error);
    }

    req.pet.expenses.splice(expenseIndex, 1);
    await req.pet.save();

    res.status(200).json({
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    const systemError = new Error(
      "An error occurred while deleting the expense."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

module.exports = { getAllExpenses, addExpense, updateExpense, deleteExpense };
