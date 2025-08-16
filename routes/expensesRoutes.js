const express = require("express");
const router = express.Router();
const {
  getAllExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
} = require("../controllers/expensesController");
const { authMW } = require("../middleware/authMW");

router.use(authMW);

// רשימה (תומך ב-petId, sort, order, limit, from, to)
router.get("/", getAllExpenses);

// יצירה (בגוף חייב להיות petId)
router.post("/", addExpense);

// עדכון/מחיקה לפי expenseId
router.put("/:expenseId", updateExpense);
router.delete("/:expenseId", deleteExpense);

module.exports = router;
