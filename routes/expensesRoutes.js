const express = require("express");
const router = express.Router();
const expensesController = require("../controllers/expensesController");
const { authMW } = require("../middleware/authMW");
const findAndAuthPet = require("../middleware/petAuthMW");

router.get(
  "/:petId",
  authMW,
  findAndAuthPet,
  expensesController.getAllExpenses
);
router.post("/:petId", authMW, findAndAuthPet, expensesController.addExpense);
router.put(
  "/:petId/:expenseId",
  authMW,
  findAndAuthPet,
  expensesController.updateExpense
);
router.delete(
  "/:petId/:expenseId",
  authMW,
  findAndAuthPet,
  expensesController.deleteExpense
);

module.exports = router;
