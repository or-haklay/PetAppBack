const {
  expenseCreate,
  expenseUpdate,
  listQuerySchema,
  Expense,
} = require("../models/ExpenseModel");
const { registerEventInternal } = require("../utils/gamificationService");

// GET /api/expenses  או  /api/pets/:petId/expenses
const getAllExpenses = async (req, res, next) => {
  try {
    // תומך גם בנתיב מקונן וגם בפרמטר query
    const petIdFromParam = req.params.petId;
    const query = { userId: req.user._id };

    // ולאידציה ל-query
    const queryToValidate = {
      ...req.query,
      petId: req.query.petId || petIdFromParam,
    };

    // בדיקה שהפרמטרים תקינים לפני הוולידציה
    const validationResult = listQuerySchema.validate(queryToValidate, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    const { error, value } = validationResult;
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    // Validation ידני מלא
    let validatedSort = "date";
    let validatedOrder = "desc";
    let validatedLimit = undefined;
    let validatedPetId = undefined;
    let validatedFrom = undefined;
    let validatedTo = undefined;

    // Validation של sort
    if (value.sort && ["date", "amount", "category"].includes(value.sort)) {
      validatedSort = value.sort;
    }

    // Validation של order
    if (value.order && ["asc", "desc"].includes(value.order)) {
      validatedOrder = value.order;
    }

    // Validation של limit
    if (value.limit !== undefined) {
      const numLimit = Number(value.limit);
      if (!isNaN(numLimit) && numLimit >= 1 && numLimit <= 200) {
        validatedLimit = numLimit;
      }
    }

    // Validation של petId
    if (
      value.petId &&
      typeof value.petId === "string" &&
      value.petId.length === 24
    ) {
      validatedPetId = value.petId;
    }

    // Validation של תאריכים
    if (value.from) {
      const dateFrom = new Date(value.from);
      if (!isNaN(dateFrom.getTime())) {
        validatedFrom = dateFrom;
      }
    }
    if (value.to) {
      const dateTo = new Date(value.to);
      if (!isNaN(dateTo.getTime())) {
        validatedTo = dateTo;
      }
    }

    // בדיקה ידנית של טווח התאריכים
    if (validatedFrom && validatedTo && validatedFrom >= validatedTo) {
      const dateError = new Error("תאריך 'to' חייב להיות אחרי תאריך 'from'");
      dateError.statusCode = 400;
      return next(dateError);
    }

    if (validatedPetId) query.petId = validatedPetId;
    if (validatedFrom || validatedTo) {
      query.date = {};
      if (validatedFrom) query.date.$gte = validatedFrom;
      if (validatedTo) query.date.$lte = validatedTo;
    }

    // מיפוי סורט
    let sortField = validatedSort || "date";
    const sortOrder = validatedOrder === "desc" ? -1 : 1;

    // וידוא שהשדה תקין
    const validSortFields = ["date", "amount", "category"];
    if (!validSortFields.includes(sortField)) {
      console.warn("⚠️ Invalid sort field, falling back to date");
      sortField = "date";
    }

    // בדיקה שהשדה קיים במסד הנתונים
    const sampleExpense = await Expense.findOne(query).lean();
    if (sampleExpense) {
      // בדיקה שהשדה קיים
      if (sampleExpense[sortField] === undefined) {
        console.warn("⚠️ Sort field not found, falling back to date");
        sortField = "date";
      }
    }

    // בדיקה שהמיון עובד עם query פשוט
    try {
      const testQuery = Expense.find({ userId: req.user._id })
        .sort({ [sortField]: sortOrder })
        .limit(3);
      const testResults = await testQuery.lean();
    } catch (testError) {
      console.error("❌ Test sort failed:", testError);
    }

    let q = Expense.find(query).sort({ [sortField]: sortOrder, _id: 1 });
    if (validatedLimit) q = q.limit(validatedLimit);

    try {
      const expenses = await q.lean();
      return res.status(200).json({ expenses });
    } catch (sortError) {
      console.error("❌ Error during sorting:", sortError);

      // נסה ללא מיון אם יש בעיה
      try {
        const fallbackQuery = Expense.find(query);
        if (validatedLimit) fallbackQuery.limit(validatedLimit);
        const expenses = await fallbackQuery.lean();
        return res.status(200).json({ expenses });
      } catch (fallbackError) {
        console.error("❌ Fallback query also failed:", fallbackError);
        throw fallbackError;
      }
    }
  } catch (err) {
    console.error("💥 Error in getAllExpenses:", err);

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

    // ניקוי שדות undefined
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] === undefined) {
        delete req.body[key];
      }
    });

    const { error, value } = expenseCreate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      console.error("❌ Validation error:", error.details);
      error.statusCode = 400;
      return next(error);
    }

    const expense = await Expense.create({ ...value, userId: req.user._id });

    // Gamification: award once per day per expense id
    let pointsAdded = 0;
    try {
      const result = await registerEventInternal(req.user._id, {
        eventKey: "ADD_EXPENSE",
        targetId: String(expense._id),
      });
      pointsAdded = Number(result?.pointsAdded || 0);
    } catch (e) {
      console.error("[gamification] ADD_EXPENSE failed:", e.message || e);
    }

    return res.status(201).json({
      message: "Expense added successfully",
      expense,
      pointsAdded,
    });
  } catch (err) {
    console.error("💥 Error in addExpense:", err);
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

    const { error, value } = expenseUpdate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const updated = await Expense.findOneAndUpdate(
      { _id: expenseId, userId: req.user._id },
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
      userId: req.user._id,
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
