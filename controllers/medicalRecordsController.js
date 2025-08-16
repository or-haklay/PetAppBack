const {
  MedicalRecord,
  medicalCreate,
  medicalUpdate,
  medicalListQuery,
} = require("../models/MedicalRecordModel");

const getAllMedicalRecords = async (req, res, next) => {
  try {
    const petIdFromParam = req.params.petId;
    const { error, value } = medicalListQuery.validate(
      { ...req.query, petId: req.query.petId || petIdFromParam },
      { abortEarly: false, stripUnknown: true, convert: true }
    );
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const { petId, from, to, sort, order, limit } = value;
    const q = { userId: req.user.id };
    if (petId) q.petId = petId;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }
    const sortField = sort || "date";
    const sortOrder = order === "asc" ? 1 : -1;

    let cursor = MedicalRecord.find(q).sort({ [sortField]: sortOrder, _id: 1 });
    if (limit) cursor = cursor.limit(limit);

    const records = await cursor.lean();
    res.status(200).json({ records });
  } catch (err) {
    const e = new Error("An error occurred while fetching medical records.");
    e.statusCode = 500;
    next(e);
  }
};

const addMedicalRecord = async (req, res, next) => {
  try {
    if (req.params.petId && !req.body.petId) req.body.petId = req.params.petId;

    const { error, value } = medicalCreate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const doc = await MedicalRecord.create({ ...value, userId: req.user.id });
    res
      .status(201)
      .json({ message: "Medical record added successfully", record: doc });
  } catch (err) {
    const e = new Error("An error occurred while adding the medical record.");
    e.statusCode = 500;
    next(e);
  }
};

const updateMedicalRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    if (!recordId) {
      const e = new Error("Record ID is required");
      e.statusCode = 400;
      return next(e);
    }

    const { error, value } = medicalUpdate.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const updated = await MedicalRecord.findOneAndUpdate(
      { _id: recordId, userId: req.user.id },
      value,
      { new: true }
    );
    if (!updated) {
      const e = new Error("Medical record not found");
      e.statusCode = 404;
      return next(e);
    }

    res.status(200).json({
      message: "Medical record updated successfully",
      record: updated,
    });
  } catch (err) {
    const e = new Error("An error occurred while updating the medical record.");
    e.statusCode = 500;
    next(e);
  }
};

const deleteMedicalRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const deleted = await MedicalRecord.findOneAndDelete({
      _id: recordId,
      userId: req.user.id,
    });
    if (!deleted) {
      const e = new Error("Medical record not found");
      e.statusCode = 404;
      return next(e);
    }
    res.status(200).json({ message: "Medical record deleted successfully" });
  } catch (err) {
    const e = new Error("An error occurred while deleting the medical record.");
    e.statusCode = 500;
    next(e);
  }
};

module.exports = {
  getAllMedicalRecords,
  addMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
};
