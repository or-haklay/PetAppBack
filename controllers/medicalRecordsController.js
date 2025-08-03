const { Pet, addMedicalRecordSchema } = require("../models/petModel");
const _ = require("lodash");

const addMedicalRecord = async (req, res, next) => {
  try {
    //request body validation
    const { error } = addMedicalRecordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const newMedicalRecordData = req.body;
    console.log("New Medical Record Data:", newMedicalRecordData);

    req.pet.medicalRecords.push(newMedicalRecordData);
    await req.pet.save();

    res.status(201).json({
      message: "Medical record added successfully",
      medicalRecord: newMedicalRecordData,
    });
  } catch (error) {
    const errorMessage = new Error("Failed to add medical record");
    errorMessage.statusCode = 500;
    return next(errorMessage);
  }
};

const getMedicalRecords = async (req, res, next) => {
  try {
    let medicalRecords = req.pet.medicalRecords;
    if (!medicalRecords || medicalRecords.length === 0) {
      return res.status(404).json({ message: "No medical records found" });
    }
    if (req.query.sort) {
      const sort = req.query.sort;
      medicalRecords = _.orderBy(medicalRecords, [sort], ["asc"]);
    }
    if (req.query.limit) {
      const limit = parseInt(req.query.limit, 10);
      if (!isNaN(limit)) {
        medicalRecords = medicalRecords.slice(0, limit);
      }
    }
    console.log("Retrieved Medical Records:", medicalRecords);

    res.status(200).json({
      medicalRecords,
    });
  } catch (error) {
    const errorMessage = new Error("Failed to retrieve medical records");
    errorMessage.statusCode = 500;
    return next(errorMessage);
  }
};

const getMedicalRecordById = async (req, res, next) => {
  try {
    const recordId = req.params.recordId;
    const medicalRecord = req.pet.medicalRecords.id(recordId);
    if (!medicalRecord) {
      return res.status(404).json({ message: "Medical record not found" });
    }

    res.status(200).json({
      medicalRecord,
    });
  } catch (error) {
    const errorMessage = new Error("Failed to retrieve medical record");
    errorMessage.statusCode = 500;
    return next(errorMessage);
  }
};

const updateMedicalRecord = async (req, res, next) => {
  try {
    const recordId = req.params.recordId;

    const index = req.pet.medicalRecords.findIndex(
      (record) => record._id.toString() === recordId
    );

    if (index === -1) {
      const error = new Error("Medical record not found");
      error.statusCode = 404;
      return next(error);
    }
    const existingRecord = req.pet.medicalRecords[index];
    const updatedData = {
      ...existingRecord.toObject(),
      ...req.body,
    };

    const { error } = addMedicalRecordSchema.validate(updatedData, {
      stripUnknown: true,
    });

    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }

    Object.assign(existingRecord, updatedData);

    await req.pet.save();

    res.status(200).json({
      message: "Medical record updated successfully",
      medicalRecord: existingRecord,
    });
  } catch (error) {
    const errorMessage = new Error("Failed to update medical record");
    errorMessage.statusCode = 500;
    return next(errorMessage);
  }
};

const deleteMedicalRecord = async (req, res, next) => {
  try {
    const recordId = req.params.recordId;

    const medicalRecordIndex = req.pet.medicalRecords.findIndex(
      (record) => record._id.toString() === recordId
    );

    if (medicalRecordIndex === -1) {
      const error = new Error("Medical record not found");
      error.statusCode = 404;
      return next(error);
    }

    const deletedRecord = req.pet.medicalRecords[medicalRecordIndex];

    req.pet.medicalRecords.splice(medicalRecordIndex, 1);

    await req.pet.save();

    res.status(200).json({
      message: "Medical record deleted successfully",
      deletedMedicalRecord: deletedRecord,
    });
  } catch (error) {
    const errorMessage = new Error("Failed to delete medical record");
    errorMessage.statusCode = 500;
    return next(errorMessage);
  }
};

module.exports = {
  addMedicalRecord,
  getMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord,
};
