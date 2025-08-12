const { Pet, createPetSchema, updatePetSchema } = require("../models/petModel"); // Assuming you have a Pet model defined
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
  const pet = await Pet.findOne({ _id: req.params.id }).lean();
  console.log("Pet found:", pet);

  // request validation
  if (
    !pet ||
    !req.user ||
    (req.user._id !== pet.owner.toString() && !req.user.isAdmin)
  ) {
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

  //response
  res.json({ message: "Get pet by ID", pet: pet });
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
      return res.status(404).json({ message: "No pets found for this user" });
    }
    // Map to return only necessary fields
    const safePets = pets.map((pet) => ({
      _id: pet._id,
      name: pet.name,
      type: pet.type,
      birthDate: pet.birthDate,
      profilePictureUrl: pet.profilePictureUrl,
    }));
    res.json({ pets: safePets });
  } catch (error) {
    const dbError = new Error("Database error occurred while fetching pets");
    dbError.statusCode = 500;
    return next(dbError);
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

  // process
  await Pet.deleteOne({ _id: req.params.id });

  //response
  res.json({ message: "Pet deleted", pet: pet });
};

module.exports = {
  getAllPets,
  getPetById,
  createPet,
  updatePet,
  deletePet,
  getMyPets,
};
