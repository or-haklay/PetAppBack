const express = require("express");
const router = express.Router();
const medicalRecordsController = require("../controllers/medicalRecordsController");
const { authMW } = require("../middleware/authMW");
const findAndAuthPet = require("../middleware/petAuthMW");

router.post(
  "/:petId",
  authMW,
  findAndAuthPet,
  medicalRecordsController.addMedicalRecord
);
router.get(
  "/:petId",
  authMW,
  findAndAuthPet,
  medicalRecordsController.getMedicalRecords
);
router.get(
  "/:petId/:recordId",
  authMW,
  findAndAuthPet,
  medicalRecordsController.getMedicalRecordById
);
router.put(
  "/:petId/:recordId",
  authMW,
  findAndAuthPet,
  medicalRecordsController.updateMedicalRecord
);
router.delete(
  "/:petId/:recordId",
  authMW,
  findAndAuthPet,
  medicalRecordsController.deleteMedicalRecord
);

module.exports = router;
