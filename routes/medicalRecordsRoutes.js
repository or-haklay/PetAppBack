const express = require("express");
const router = express.Router();
const medicalRecordsController = require("../controllers/medicalRecordsController");
const { authMW } = require("../middleware/authMW");

/* router.post("/:id", authMW, medicalRecordsController.addMedicalRecord);
 */
module.exports = router;
