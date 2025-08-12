const express = require("express");
const router = express.Router();
const petsController = require("../controllers/petsController");
const { authMW } = require("../middleware/authMW");
const expensesRoutes = require("./expensesRoutes");
const remindersRoutes = require("./remindersRoutes");
const medicalRecordsRoutes = require("./medicalRecordsRoutes");

router.get("/", authMW, petsController.getAllPets);
router.get("/my-pets", authMW, petsController.getMyPets);
router.get("/:id", authMW, petsController.getPetById);
router.post("/", authMW, petsController.createPet);
router.put("/:id", authMW, petsController.updatePet);
router.delete("/:id", authMW, petsController.deletePet);
router.use("/expenses", expensesRoutes);
router.use("/reminders", remindersRoutes);
router.use("/medical-records", medicalRecordsRoutes);

module.exports = router;
