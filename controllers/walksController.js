const { Walk, createWalkSchema, updateWalkSchema } = require("../models/walkModel");
const {
  calculateTotalDistance,
  calculateTotalDuration,
  isNearStartPoint,
  isStoppedForDuration,
  detectAndAddPois,
  processWalkCompletion,
} = require("../services/walkService");
const Joi = require("joi");

// Create a new walk
const createWalk = async (req, res, next) => {
  try {
    const { error } = createWalkSchema.validate(req.body);
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const { petId, pet, startTime, route, pois, title, isAutoCompleted, distance, duration, endTime } = req.body;

    const newWalk = new Walk({
      petId,
      pet,
      userId: req.user._id, // User ID from auth middleware
      startTime: startTime || new Date(),
      endTime,
      route: route || [],
      pois: pois || [],
      distance: distance || 0,
      duration: duration || 0,
      title,
      isAutoCompleted,
    });

    await newWalk.save();
    res.status(201).json(newWalk);
  } catch (error) {
    next(error);
  }
};

// Update an existing walk (e.g., add new route points, end walk)
const updateWalk = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = updateWalkSchema.validate(req.body);
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const walk = await Walk.findOne({ _id: id, userId: req.user._id });
    if (!walk) {
      const error = new Error("Walk not found or unauthorized");
      error.statusCode = 404;
      return next(error);
    }

    // Handle route updates
    if (req.body.route && req.body.route.length > 0) {
      walk.route.push(...req.body.route);
      // Recalculate distance and duration on the fly for active walks
      walk.distance = calculateTotalDistance(walk.route);
      walk.duration = calculateTotalDuration(walk.route);

      // Detect and add POIs if the walk is active
      if (!walk.endTime) {
        await detectAndAddPois(walk._id, walk.route, req.user._id);
      }
    }

    // Handle ending the walk
    if (req.body.endTime && !walk.endTime) {
      await processWalkCompletion(walk._id, req.user._id);
      // Re-fetch the walk to get updated fields from processWalkCompletion
      const completedWalk = await Walk.findById(walk._id);
      return res.json(completedWalk);
    }

    // Update other fields
    Object.keys(req.body).forEach((key) => {
      if (key !== "route" && key !== "endTime") {
        walk[key] = req.body[key];
      }
    });

    await walk.save();
    res.json(walk);
  } catch (error) {
    next(error);
  }
};

// Get a single walk by ID (for authenticated users)
const getWalkById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const walk = await Walk.findOne({ 
      _id: id,
      $or: [
        { userId: req.user._id }, // User is owner
        { isShared: true } // Or walk is shared
      ]
    }).populate(
      "petId",
      "name profilePictureUrl"
    );
    if (!walk) {
      const error = new Error("Walk not found or unauthorized");
      error.statusCode = 404;
      return next(error);
    }
    res.json(walk);
  } catch (error) {
    next(error);
  }
};

// Get a single walk by ID (public endpoint - no auth required)
const getPublicWalkById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    console.log("📋 [getPublicWalkById] Public walk request:", { 
      id, 
      path: req.path, 
      originalUrl: req.originalUrl,
      method: req.method,
      headers: req.headers
    });
    
    // Validate ObjectId format
    if (!id || id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(id)) {
      console.log("❌ [getPublicWalkById] Invalid ID format:", id);
      const error = new Error("Invalid walk ID format");
      error.statusCode = 400;
      return next(error);
    }
    
    const walk = await Walk.findOne({ 
      _id: id,
      isShared: true // Only return if walk is shared
    }).populate(
      "petId",
      "name profilePictureUrl"
    ).lean(); // Use lean() for better performance and to avoid Mongoose errors
    
    if (!walk) {
      console.log("❌ [getPublicWalkById] Walk not found or not shared:", id);
      const error = new Error("Walk not found or not shared");
      error.statusCode = 404;
      return next(error);
    }
    
    // Handle case where petId might be null or the populate failed
    if (!walk.petId && walk.pet) {
      // If petId is null but pet object exists, use it
      walk.petId = walk.pet;
    }
    
    console.log("✅ [getPublicWalkById] Walk found:", walk._id);
    res.json(walk);
  } catch (error) {
    console.error("❌ [getPublicWalkById] Error:", error);
    // Handle CastError (invalid ObjectId)
    if (error.name === "CastError") {
      const castError = new Error("Invalid walk ID format");
      castError.statusCode = 400;
      return next(castError);
    }
    // Handle other errors
    const dbError = new Error("Database error occurred while fetching walk");
    dbError.statusCode = 500;
    return next(dbError);
  }
};

// Get all walks for a specific pet
const getWalksByPetId = async (req, res, next) => {
  try {
    const { petId } = req.params;
    
    // Prevent this route from catching /public/ requests
    // If petId is "public", it means this route incorrectly matched /public/:id
    if (petId === 'public' || (req.path && req.path.startsWith('/public/'))) {
      console.log("⚠️ [getWalksByPetId] Route incorrectly matched /public/ request, passing to next");
      return next();
    }
    
    const walks = await Walk.find({ petId, userId: req.user._id })
      .sort({ startTime: -1 })
      .populate("petId", "name profilePictureUrl");
    res.json(walks);
  } catch (error) {
    next(error);
  }
};

// Delete a walk
const deleteWalk = async (req, res, next) => {
  try {
    const { id } = req.params;
    const walk = await Walk.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!walk) {
      const error = new Error("Walk not found or unauthorized");
      error.statusCode = 404;
      return next(error);
    }
    res.status(204).send(); // No content
  } catch (error) {
    next(error);
  }
};

const getWalkStats = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const stats = await Walk.find({ petId, userId: req.user._id });
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWalk,
  updateWalk,
  getWalkById,
  getPublicWalkById,
  getWalksByPetId,
  deleteWalk,
  getWalkStats,
};
