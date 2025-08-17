const {
  expenseCreate,
  expenseUpdate,
  listQuerySchema,
  Expense,
} = require("../models/ExpenseModel");

// GET /api/expenses  או  /api/pets/:petId/expenses
const getAllExpenses = async (req, res, next) => {
  try {
    // תומך גם בנתיב מקונן וגם בפרמטר query
    const petIdFromParam = req.params.petId;
    const query = { userId: req.user._id };

    console.log("🔍 getAllExpenses - Query params:", req.query);
    console.log("🔍 getAllExpenses - Route params:", req.params);
    console.log("🔍 getAllExpenses - User ID:", req.user._id);

    // ולאידציה ל-query
    console.log("🔍 Raw query params:", req.query);
    console.log("🔍 PetId from params:", petIdFromParam);
    console.log("🔍 Sort param received:", req.query.sort);
    console.log("🔍 Order param received:", req.query.order);

    const queryToValidate = {
      ...req.query,
      petId: req.query.petId || petIdFromParam,
    };
    console.log("🔍 Query to validate:", queryToValidate);

    // בדיקה שהפרמטרים תקינים לפני הוולידציה
    console.log("🔍 Checking params before validation:");
    console.log(
      "  - sort:",
      queryToValidate.sort,
      "type:",
      typeof queryToValidate.sort
    );
    console.log(
      "  - order:",
      queryToValidate.order,
      "type:",
      typeof queryToValidate.order
    );
    console.log(
      "  - petId:",
      queryToValidate.petId,
      "type:",
      typeof queryToValidate.petId
    );
    console.log(
      "  - limit:",
      queryToValidate.limit,
      "type:",
      typeof queryToValidate.limit
    );
    console.log(
      "  - from:",
      queryToValidate.from,
      "type:",
      typeof queryToValidate.from
    );
    console.log(
      "  - to:",
      queryToValidate.to,
      "type:",
      typeof queryToValidate.to
    );

    console.log("🔍 About to get Joi schema description...");
    let schemaDescription;
    try {
      schemaDescription = listQuerySchema.describe();
      console.log("🔍 Joi schema description:", schemaDescription);
    } catch (schemaError) {
      console.error("❌ Error getting schema description:", schemaError);
      console.error("❌ Schema error stack:", schemaError.stack);
      const error = new Error("Schema description error");
      error.statusCode = 500;
      return next(error);
    }

    let validationResult;
    try {
      console.log("🔍 About to call Joi validate...");
      validationResult = listQuerySchema.validate(queryToValidate, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      console.log("🔍 Joi validation completed successfully");
    } catch (validationError) {
      console.error("❌ Joi validation threw an error:", validationError);
      console.error("❌ Validation error stack:", validationError.stack);
      const error = new Error("Validation schema error");
      error.statusCode = 500;
      return next(error);
    }

    const { error, value } = validationResult;
    console.log("🔍 Validation result:", { error: !!error, value: !!value });
    if (error) {
      console.error("❌ Validation error details:", error.details);
      console.error("❌ Validation error summary:", error.message);
      console.error("❌ Failed query params:", queryToValidate);
      console.error("❌ Schema definition:", schemaDescription);
      console.error("❌ Error object:", error);
      console.error("❌ Error details array:", error.details);
      error.details.forEach((detail, index) => {
        console.error(`❌ Error detail ${index}:`, {
          message: detail.message,
          path: detail.path,
          type: detail.type,
          context: detail.context,
        });
      });
      error.statusCode = 400;
      return next(error);
    }
    console.log("✅ Validation passed, value:", value);

    // Validation ידני מלא
    let validatedSort = "date";
    let validatedOrder = "desc";
    let validatedLimit = undefined;
    let validatedPetId = undefined;
    let validatedFrom = undefined;
    let validatedTo = undefined;

    console.log("🔍 Starting manual validation...");
    console.log("🔍 Raw value object:", value);

    // Validation של sort
    if (value.sort && ["date", "amount", "category"].includes(value.sort)) {
      validatedSort = value.sort;
      console.log("✅ Sort validated:", validatedSort);
    } else {
      console.log(
        "⚠️ Sort not provided or invalid, using default:",
        validatedSort
      );
    }

    // Validation של order
    if (value.order && ["asc", "desc"].includes(value.order)) {
      validatedOrder = value.order;
      console.log("✅ Order validated:", validatedOrder);
    } else {
      console.log(
        "⚠️ Order not provided or invalid, using default:",
        validatedOrder
      );
    }

    // Validation של limit
    if (value.limit !== undefined) {
      const numLimit = Number(value.limit);
      if (!isNaN(numLimit) && numLimit >= 1 && numLimit <= 200) {
        validatedLimit = numLimit;
        console.log("✅ Limit validated:", validatedLimit);
      } else {
        console.log("⚠️ Limit invalid, ignoring:", value.limit);
      }
    } else {
      console.log("⚠️ Limit not provided");
    }

    // Validation של petId
    if (
      value.petId &&
      typeof value.petId === "string" &&
      value.petId.length === 24
    ) {
      validatedPetId = value.petId;
      console.log("✅ PetId validated:", validatedPetId);
    } else {
      console.log("⚠️ PetId not provided or invalid:", value.petId);
    }

    // Validation של תאריכים
    if (value.from) {
      const dateFrom = new Date(value.from);
      if (!isNaN(dateFrom.getTime())) {
        validatedFrom = dateFrom;
        console.log("✅ From date validated:", validatedFrom);
      } else {
        console.log("⚠️ From date invalid, ignoring:", value.from);
      }
    } else {
      console.log("⚠️ From date not provided");
    }
    if (value.to) {
      const dateTo = new Date(value.to);
      if (!isNaN(dateTo.getTime())) {
        validatedTo = dateTo;
        console.log("✅ To date validated:", validatedTo);
      } else {
        console.log("⚠️ To date invalid, ignoring:", value.to);
      }
    } else {
      console.log("⚠️ To date not provided");
    }

    console.log("✅ Manual validation results:", {
      sort: validatedSort,
      order: validatedOrder,
      limit: validatedLimit,
      petId: validatedPetId,
      from: validatedFrom,
      to: validatedTo,
    });

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

    console.log("🔍 Final query object:", query);
    console.log("🔍 Query JSON:", JSON.stringify(query, null, 2));

    // מיפוי סורט
    let sortField = validatedSort || "date";
    const sortOrder = validatedOrder === "desc" ? -1 : 1;

    console.log("🎯 Initial sort config:", { sortField, sortOrder });

    // וידוא שהשדה תקין
    const validSortFields = ["date", "amount", "category"];
    if (!validSortFields.includes(sortField)) {
      console.warn("⚠️ Invalid sort field, falling back to date");
      sortField = "date";
    }

    console.log("🎯 Final sort config:", { sortField, sortOrder });
    console.log("🔍 Final query:", query);

    // בדיקה שהשדה קיים במסד הנתונים
    console.log("🔍 About to check sample expense...");
    const sampleExpense = await Expense.findOne(query).lean();
    if (sampleExpense) {
      console.log("🔍 Sample expense found:", sampleExpense._id);
      console.log("🔍 Sample expense fields:", Object.keys(sampleExpense));
      console.log("🔍 Sample expense values:", {
        date: sampleExpense.date,
        amount: sampleExpense.amount,
        category: sampleExpense.category,
        [sortField]: sampleExpense[sortField],
      });

      // בדיקה שהשדה קיים
      if (sampleExpense[sortField] === undefined) {
        console.warn("⚠️ Sort field not found, falling back to date");
        sortField = "date";
      }
    } else {
      console.log("🔍 No sample expense found");
    }

    // בדיקה שהמיון עובד עם query פשוט
    console.log("🧪 Testing sort with simple query...");
    try {
      console.log("🧪 Building test query...");
      const testQuery = Expense.find({ userId: req.user._id })
        .sort({ [sortField]: sortOrder })
        .limit(3);
      console.log("🧪 Executing test query...");
      const testResults = await testQuery.lean();
      console.log("🧪 Test query successful, results:", testResults.length);
      console.log(
        "🧪 Test sort results:",
        testResults.map((e) => ({
          [sortField]: e[sortField],
          date: e.date,
          amount: e.amount,
          category: e.category,
        }))
      );

      // בדיקה ידנית של המיון
      console.log("🧪 Manual sort test...");
      console.log("🧪 Getting all expenses for manual sort...");
      const allExpenses = await Expense.find({ userId: req.user._id }).lean();
      console.log("🧪 Got expenses for manual sort:", allExpenses.length);
      const sortedManually = allExpenses.sort((a, b) => {
        if (sortField === "date") {
          return validatedOrder === "desc"
            ? new Date(b.date) - new Date(a.date)
            : new Date(a.date) - new Date(b.date);
        } else if (sortField === "amount") {
          return validatedOrder === "desc"
            ? b.amount - a.amount
            : a.amount - b.amount;
        } else if (sortField === "category") {
          return validatedOrder === "desc"
            ? b.category.localeCompare(a.category)
            : a.category.localeCompare(b.category);
        }
        return 0;
      });
      console.log("🧪 Manual sort completed");
      console.log(
        "🧪 Manual sort results (first 3):",
        sortedManually.slice(0, 3).map((e) => ({
          [sortField]: e[sortField],
          date: e.date,
          amount: e.amount,
          category: e.category,
        }))
      );
    } catch (testError) {
      console.error("❌ Test sort failed:", testError);
      console.error("❌ Test error stack:", testError.stack);
      console.error("❌ Test error name:", testError.name);
      console.error("❌ Test error code:", testError.code);
      console.error("❌ Test error message:", testError.message);
    }

    let q = Expense.find(query).sort({ [sortField]: sortOrder, _id: 1 });
    if (validatedLimit) q = q.limit(validatedLimit);

    console.log("🔍 About to execute MongoDB query...");
    console.log("🔍 Query string:", q.toString());
    console.log("🔍 Sort applied:", { [sortField]: sortOrder, _id: 1 });
    console.log(
      "🔍 Expected sort order:",
      validatedOrder === "desc" ? "descending" : "ascending"
    );

    try {
      console.log("🔍 Executing MongoDB query...");
      const expenses = await q.lean();
      console.log("📊 Found expenses:", expenses.length);

      // בדיקה של התוצאות הראשונות
      if (expenses.length > 0) {
        console.log("📋 First expense:", {
          _id: expenses[0]._id,
          date: expenses[0].date,
          amount: expenses[0].amount,
          category: expenses[0].category,
          sortField: expenses[0][sortField],
        });
        console.log("📋 Last expense:", {
          _id: expenses[expenses.length - 1]._id,
          date: expenses[expenses.length - 1].date,
          amount: expenses[expenses.length - 1].amount,
          category: expenses[expenses.length - 1].category,
          sortField: expenses[expenses.length - 1][sortField],
        });

        // בדיקה שהמיון עבד
        console.log("🔍 Sort verification:");
        if (sortField === "date") {
          const dates = expenses.map((e) => new Date(e.date));
          console.log(
            "📅 Dates in order:",
            dates.map((d) => d.toISOString().split("T")[0])
          );
        } else if (sortField === "amount") {
          const amounts = expenses.map((e) => e.amount);
          console.log("💰 Amounts in order:", amounts);
        } else if (sortField === "category") {
          const categories = expenses.map((e) => e.category);
          console.log("🏷️ Categories in order:", categories);
        }
      }

      console.log("✅ Successfully returning expenses");
      return res.status(200).json({ expenses });
    } catch (sortError) {
      console.error("❌ Error during sorting:", sortError);
      console.error("❌ Error stack:", sortError.stack);
      console.error("❌ Error name:", sortError.name);
      console.error("❌ Error code:", sortError.code);
      console.error("❌ Error message:", sortError.message);

      // נסה ללא מיון אם יש בעיה
      console.log("🔄 Retrying without sort...");
      try {
        console.log("🔍 Building fallback query...");
        const fallbackQuery = Expense.find(query);
        if (validatedLimit) fallbackQuery.limit(validatedLimit);
        console.log("🔍 Executing fallback query...");
        const expenses = await fallbackQuery.lean();
        console.log("📊 Found expenses (fallback):", expenses.length);
        return res.status(200).json({ expenses });
      } catch (fallbackError) {
        console.error("❌ Fallback query also failed:", fallbackError);
        console.error("❌ Fallback error stack:", fallbackError.stack);
        console.error("❌ Fallback error name:", fallbackError.name);
        console.error("❌ Fallback error code:", fallbackError.code);
        console.error("❌ Fallback error message:", fallbackError.message);
        throw fallbackError;
      }
    }
  } catch (err) {
    console.error("💥 Error in getAllExpenses:", err);
    console.error("💥 Error stack:", err.stack);
    console.error("💥 Error message:", err.message);
    console.error("💥 Error name:", err.name);
    console.error("💥 Error code:", err.code);

    // בדיקה אם זה שגיאת MongoDB
    if (err.name === "MongoError" || err.name === "MongoServerError") {
      console.error("💥 MongoDB Error Details:", {
        code: err.code,
        codeName: err.codeName,
        writeErrors: err.writeErrors,
        errmsg: err.errmsg,
      });
    }

    // בדיקה אם זה שגיאת Joi
    if (err.name === "ValidationError") {
      console.error("💥 Joi Validation Error Details:", {
        details: err.details,
        message: err.message,
      });
    }

    const systemError = new Error("An error occurred while fetching expenses.");
    systemError.statusCode = 500;
    return next(systemError);
  }
};

// POST /api/expenses  או  /api/pets/:petId/expenses
const addExpense = async (req, res, next) => {
  try {
    console.log("💰 Adding expense with data:", {
      body: req.body,
      params: req.params,
      user: req.user._id,
    });

    // אם הנתיב מקונן—נזריק petId מה-params לגוף
    if (req.params.petId && !req.body.petId) {
      req.body.petId = req.params.petId;
      console.log("🔗 Added petId from params:", req.params.petId);
    }

    // ניקוי שדות undefined
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] === undefined) {
        delete req.body[key];
        console.log(`🧹 Removed undefined field: ${key}`);
      }
    });

    console.log("📝 Validating expense data:", req.body);

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

    console.log("✅ Validated expense data:", value);

    const expense = await Expense.create({ ...value, userId: req.user._id });
    console.log("💾 Expense created successfully:", expense);

    return res.status(201).json({
      message: "Expense added successfully",
      expense,
    });
  } catch (err) {
    console.error("💥 Error in addExpense:", err);
    console.error("💥 Error stack:", err.stack);
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
