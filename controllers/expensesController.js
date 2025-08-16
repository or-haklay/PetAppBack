const {
  addExpenseSchema,
  updateExpenseSchema,
  listQuerySchema,
  Expense,
} = require("../models/ExpenseModel");

// GET /api/expenses  או  /api/pets/:petId/expenses
const getAllExpenses = async (req, res, next) => {
  try {
    // תומך גם בנתיב מקונן וגם בפרמטר query
    const petIdFromParam = req.params.petId;
    const query = { userId: req.user.id };

    // ולאידציה ל-query
    const { error, value } = listQuerySchema.validate(
      { ...req.query, petId: req.query.petId || petIdFromParam },
      { abortEarly: false, stripUnknown: true, convert: true }
    );
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const { sort, order, limit, petId, from, to } = value;

    if (petId) query.petId = petId;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    // מיפוי סורט
    const sortField = sort || "date";
    const sortOrder = order === "desc" ? -1 : 1;

    let q = Expense.find(query).sort({ [sortField]: sortOrder, _id: 1 });
    if (limit) q = q.limit(limit);

    const expenses = await q.lean();

    return res.status(200).json({ expenses });
  } catch (err) {
    const systemError = new Error("An error occurred while fetching expenses.");
    systemError.statusCode = 500;
    return next(systemError);
  }
};

// POST /api/expenses  או  /api/pets/:petId/expenses
const addExpense = async (req, res, next) => {
  try {
    // אם הנתיב מקונן—נזריק petId מה-params לגוף
    if (req.params.petId && !req.body.petId) {
      req.body.petId = req.params.petId;
    }

    const { error, value } = addExpenseSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const expense = await Expense.create({ ...value, userId: req.user.id });
    console.log("Expense added:", expense); // משאיר את הלוג כמו שאהבת

    return res.status(201).json({
      message: "Expense added successfully",
      expense,
    });
  } catch (err) {
    const systemError = new Error(
      "An error occurred while adding the expense."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

// PUT /api/expenses/:expenseId
const updateExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    if (!expenseId) {
      const error = new Error("Expense ID is required");
      error.statusCode = 400;
      return next(error);
    }

    const { error, value } = updateExpenseSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const updated = await Expense.findOneAndUpdate(
      { _id: expenseId, userId: req.user.id },
      value,
      { new: true }
    );

    if (!updated) {
      const notFound = new Error("Expense not found");
      notFound.statusCode = 404;
      return next(notFound);
    }

    return res.status(200).json({
      message: "Expense updated successfully",
      expense: updated,
    });
  } catch (err) {
    console.error("Error updating expense:", err);
    const systemError = new Error(
      "An error occurred while updating the expense."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

// DELETE /api/expenses/:expenseId
const deleteExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const deleted = await Expense.findOneAndDelete({
      _id: expenseId,
      userId: req.user.id,
    });
    if (!deleted) {
      const error = new Error("Expense not found");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense:", err);
    const systemError = new Error(
      "An error occurred while deleting the expense."
    );
    systemError.statusCode = 500;
    return next(systemError);
  }
};

module.exports = { getAllExpenses, addExpense, updateExpense, deleteExpense };
