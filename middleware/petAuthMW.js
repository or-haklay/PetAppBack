const { Pet } = require("../models/petModel");

const findAndAuthPet = async (req, res, next) => {
  try {
    const petId = req.params && req.params.petId;
    const pet = petId ? await Pet.findById(petId) : null;

    if (!pet) {
      const error = new Error("Pet not found.");
      error.statusCode = 404;
      return next(error);
    }

    if (
      !req.user ||
      (!pet.owner.equals(req.user.userId) && !req.user.isAdmin)
    ) {
      const error = new Error("Unauthorized access to this pet.");
      error.statusCode = 403;
      return next(error);
    }

    req.pet = pet;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = findAndAuthPet;
