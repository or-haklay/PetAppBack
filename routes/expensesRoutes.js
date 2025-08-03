const express = require("express");
const router = express.Router();
const expensesController = require("../controllers/expensesController");
const { authMW } = require("../middleware/authMW");
const expensesRoutes = require("./expensesRoutes");

router.get("/:id", authMW, expensesController.getAllExpenses);
router.post("/:id", authMW, expensesController.addExpense);
router.put("/:id/:expenseId", authMW, expensesController.updateExpense);
router.delete("/:id/:expenseId", authMW, expensesController.deleteExpense);

module.exports = router;
