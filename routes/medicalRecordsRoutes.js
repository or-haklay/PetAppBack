const express = require("express");
const router = express.Router();
const c = require("../controllers/medicalRecordsController");
const { authMW } = require("../middleware/authMW");

router.use(authMW);

router.get("/", c.getAllMedicalRecords);
router.post("/", c.addMedicalRecord);
router.put("/:recordId", c.updateMedicalRecord);
router.delete("/:recordId", c.deleteMedicalRecord);

module.exports = router;
