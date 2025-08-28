const { Pet, createPetSchema, updatePetSchema } = require("../models/petModel"); // Assuming you have a Pet model defined
const { MedicalRecord } = require("../models/MedicalRecordModel");
const { Reminder } = require("../models/ReminderModel");
const { Expense } = require("../models/ExpenseModel");
const _ = require("lodash");

const getAllPets = async (req, res, next) => {
  try {
    // request validation
    if (!req.user || !req.user.isAdmin) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 403;
      return next(validationError);
    }

    if (req.query.limit && isNaN(req.query.limit)) {
      const validationError = new Error("Limit must be a number");
      validationError.statusCode = 400;
      return next(validationError);
    }

    if (req.query.sort && !["name", "email"].includes(req.query.sort)) {
      const validationError = new Error("Invalid sort field");
      validationError.statusCode = 400;
      return next(validationError);
    }
    // process
    const pets = await Pet.find({}, null, {
      limit: req.query.limit,
      sort: { [req.query.sort]: 1 },
    }).lean();
    const safePets = _.map(pets, (pet) => {
      return _.pick(pet, [
        "_id",
        "name",
        "type",
        "birthDate",
        "profilePictureUrl",
      ]);
    });
    // response
    res.json({
      message: `Get all pets ${
        req.query.limit ? `with limit ${req.query.limit}` : "without limit"
      }`,
      pets: safePets,
    });
  } catch (error) {
    const dbError = new Error("Database error occurred while fetching pets");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const getPetById = async (req, res, next) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id }).lean();

    // Check if pet exists first
    if (!pet) {
      const validationError = new Error("Pet not found");
      validationError.statusCode = 404;
      return next(validationError);
    }

    // Check authorization
    if (
      !req.user ||
      (req.user._id !== pet.owner.toString() && !req.user.isAdmin)
    ) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 403;
      return next(validationError);
    }

    //response
    res.json({ message: "Get pet by ID", pet: pet });
  } catch (error) {
    console.error("Error in getPetById:", error);
    const dbError = new Error("Database error occurred while fetching pet");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const getMyPets = async (req, res, next) => {
  try {
    const { _id: userId } = req.user;
    if (!userId) {
      const authError = new Error("Authentication required");
      authError.statusCode = 401;
      return next(authError);
    }
    const pets = await Pet.find({ owner: userId });
    if (!pets || pets.length === 0) {
      return res.json({ pets: [] });
    }
    // קבלת מידע מקיף לכל חיה
    console.log(`🐾 Getting comprehensive info for ${pets.length} pets...`);
    const comprehensivePets = await Promise.all(
      pets.map((pet) => getComprehensivePetInfo(pet))
    );

    console.log(
      `✅ Successfully retrieved comprehensive info for ${comprehensivePets.length} pets`
    );
    res.json({ pets: comprehensivePets });
  } catch (error) {
    console.error("Error in getMyPets:", error);
    const dbError = new Error("Database error occurred while fetching pets");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// פונקציה חדשה להחזרת מידע מקיף על החיה
const getComprehensivePetInfo = async (pet) => {
  try {
    const petId = pet._id;

    // קבלת רשומות רפואיות
    const medicalRecords = await MedicalRecord.find({ petId })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    // קבלת תזכורות פעילות
    const activeReminders = await Reminder.find({
      petId,
      isCompleted: false,
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .limit(5)
      .lean();

    // קבלת הוצאות אחרונות
    const recentExpenses = await Expense.find({ petId })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    // חישוב סטטיסטיקות
    const totalExpenses = await Expense.aggregate([
      { $match: { petId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalExpensesAmount =
      totalExpenses.length > 0 ? totalExpenses[0].total : 0;

    // חישוב גיל
    let age = null;
    if (pet.birthDate) {
      const birth = new Date(pet.birthDate);
      const now = new Date();
      const diffTime = Math.abs(now - birth);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 30) age = `${diffDays} days`;
      else if (diffDays < 365) age = `${Math.floor(diffDays / 30)} months`;
      else age = `${Math.floor(diffDays / 365)} years`;
    }

    return {
      // מידע בסיסי על החיה
      _id: pet._id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      sex: pet.sex,
      weightKg: pet.weightKg,
      color: pet.color,
      chipNumber: pet.chipNumber,
      notes: pet.notes,
      birthDate: pet.birthDate,
      profilePictureUrl: pet.profilePictureUrl,
      coverPictureUrl: pet.coverPictureUrl,
      owner: pet.owner,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt,

      // מידע מחושב
      age: age,

      // רשומות רפואיות
      medicalRecords: medicalRecords.map((record) => ({
        recordName: record.recordName,
        recordType: record.recordType,
        date: record.date,
        description: record.description,
        veterinarianName: record.veterinarianName,
        clinic: record.clinic,
      })),

      // תזכורות פעילות
      activeReminders: activeReminders.map((reminder) => ({
        title: reminder.title,
        description: reminder.description,
        date: reminder.date,
        time: reminder.time,
        repeatInterval: reminder.repeatInterval,
      })),

      // הוצאות
      recentExpenses: recentExpenses.map((expense) => ({
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        vendor: expense.vendor,
      })),

      // סטטיסטיקות
      totalExpensesAmount: totalExpensesAmount,
      expensesCount: recentExpenses.length,
      medicalRecordsCount: medicalRecords.length,
      activeRemindersCount: activeReminders.length,
    };
  } catch (error) {
    console.error("Error getting comprehensive pet info:", error);
    // אם יש שגיאה, נחזיר רק את המידע הבסיסי
    return {
      _id: pet._id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      sex: pet.sex,
      weightKg: pet.weightKg,
      color: pet.color,
      chipNumber: pet.chipNumber,
      notes: pet.notes,
      birthDate: pet.birthDate,
      profilePictureUrl: pet.profilePictureUrl,
      coverPictureUrl: pet.coverPictureUrl,
      owner: pet.owner,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt,
    };
  }
};

const createPet = async (req, res, next) => {
  try {
    // request validation
    if (!req.user || !req.user._id) {
      const authError = new Error("Authentication required");
      authError.statusCode = 401;
      return next(authError);
    }

    // extract owner from request body
    const { owner, ...petData } = req.body;

    // request validation
    const { error } = createPetSchema.validate(petData);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }

    //system validation
    const existingPet = await Pet.findOne({
      name: petData.name,
      owner: req.user._id,
    });
    if (existingPet) {
      const validationError = new Error("Pet with this name already exists");
      validationError.statusCode = 409;
      return next(validationError);
    }

    // process
    petData.owner = req.user._id;
    const pet = new Pet(petData);
    const savedPet = await pet.save();

    res.status(201).send({ message: "Pet created", pet: savedPet });
  } catch (error) {
    console.error("Error saving pet:", error);
    const dbError = new Error("Database error occurred while creating pet");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const updatePet = async (req, res, next) => {
  try {
    const pet = await Pet.findById(req.params.id);
    // system validation
    if (!pet) {
      const validationError = new Error("Pet not found");
      validationError.statusCode = 404;
      return next(validationError);
    }

    // authorization
    if (!req.user || (!pet.owner.equals(req.user._id) && !req.user.isAdmin)) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 403;
      return next(validationError);
    }

    // request validation
    const { error } = updatePetSchema.validate(req.body);
    if (error) {
      const validationError = new Error(error.details[0].message);
      validationError.statusCode = 400;
      return next(validationError);
    }

    // process
    const updatedPet = await Pet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json({ message: "Pet updated", pet: updatedPet });
  } catch (error) {
    console.error("Error updating pet:", error);
    const dbError = new Error("Database error occurred while updating pet");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

const deletePet = async (req, res, next) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id }).lean();

    // request validation
    if (!req.user || (!pet.owner.equals(req.user._id) && !req.user.isAdmin)) {
      const validationError = new Error("Unauthorized access");
      validationError.statusCode = 403;
      return next(validationError);
    }

    //system validation
    if (!pet) {
      const validationError = new Error("Pet not found");
      validationError.statusCode = 404;
      return next(validationError);
    }

    console.log(
      `🗑️ Starting deletion of pet ${pet.name} (ID: ${req.params.id}) and all related records...`
    );

    // מחיקת כל ההרשומות הקשורות לחיה
    const petId = req.params.id;
    const userId = req.user._id;

    // מחיקת הוצאות
    const deletedExpenses = await Expense.deleteMany({ petId, userId });
    console.log(`💰 Deleted ${deletedExpenses.deletedCount} expenses`);

    // מחיקת תזכורות
    const deletedReminders = await Reminder.deleteMany({ petId, userId });
    console.log(`⏰ Deleted ${deletedReminders.deletedCount} reminders`);

    // מחיקת קבצים במסמכים רפואיים מ-S3 לפני מחיקת המסמכים
    const medicalRecordsToDelete = await MedicalRecord.find({
      petId,
      userId,
    }).lean();
    for (const record of medicalRecordsToDelete) {
      if (record.fileUrl) {
        try {
          // חילוץ שם הקובץ מה-URL
          const fileName = record.fileUrl.split("/").pop();
          const { deleteFromS3 } = require("../config/s3Config");
          await deleteFromS3(fileName);
          console.log(`📄 Deleted medical record file: ${fileName}`);
        } catch (fileError) {
          console.warn(
            "⚠️ Could not delete medical record file:",
            fileError.message
          );
        }
      }
    }

    // מחיקת מסמכים רפואיים מהמסד נתונים
    const deletedMedicalRecords = await MedicalRecord.deleteMany({
      petId,
      userId,
    });
    console.log(
      `🏥 Deleted ${deletedMedicalRecords.deletedCount} medical records`
    );

    // מחיקת תמונות מ-S3 אם יש
    if (pet.profilePictureUrl) {
      try {
        // חילוץ שם הקובץ מה-URL
        const fileName = pet.profilePictureUrl.split("/").pop();
        const { deleteFromS3 } = require("../config/s3Config");
        await deleteFromS3(fileName);
        console.log(`🖼️ Deleted profile picture: ${fileName}`);
      } catch (imageError) {
        console.warn(
          "⚠️ Could not delete profile picture:",
          imageError.message
        );
      }
    }

    if (pet.coverPictureUrl) {
      try {
        // חילוץ שם הקובץ מה-URL
        const fileName = pet.coverPictureUrl.split("/").pop();
        const { deleteFromS3 } = require("../config/s3Config");
        await deleteFromS3(fileName);
        console.log(`🖼️ Deleted cover picture: ${fileName}`);
      } catch (imageError) {
        console.warn("⚠️ Could not delete cover picture:", imageError.message);
      }
    }

    // מחיקת החיה עצמה
    await Pet.deleteOne({ _id: req.params.id });
    console.log(`🐾 Deleted pet: ${pet.name}`);

    //response
    res.json({
      message: "Pet and all related records deleted successfully",
      pet: pet,
      deletedCounts: {
        expenses: deletedExpenses.deletedCount,
        reminders: deletedReminders.deletedCount,
        medicalRecords: deletedMedicalRecords.deletedCount,
      },
    });
  } catch (error) {
    console.error("❌ Error deleting pet:", error);
    const dbError = new Error("Database error occurred while deleting pet");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

module.exports = {
  getAllPets,
  getPetById,
  createPet,
  updatePet,
  deletePet,
  getMyPets,
};
