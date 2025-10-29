const express = require("express");
const router = express.Router();
const walksController = require("../controllers/walksController");
const { authMW } = require("../middleware/authMW");

// Apply authentication middleware to all routes
router.use(authMW);

/**
 * @route POST /api/walks
 * @desc Create a new walk
 * @access Private
 */
router.post("/", walksController.createWalk);

/**
 * @route GET /api/walks/walk/:id
 * @desc Get a single walk by ID
 * @access Private
 */
router.get("/walk/:id", walksController.getWalkById);

/**
 * @route GET /api/walks/:petId/stats
 * @desc Get walk statistics for a pet
 * @access Private
 * @query period (week/month/year)
 */
router.get("/:petId/stats", walksController.getWalkStats);

/**
 * @route GET /api/walks/:petId
 * @desc Get all walks for a specific pet
 * @access Private
 * @query page, limit, startDate, endDate
 */
router.get("/:petId", walksController.getWalksByPetId);

/**
 * @route PATCH /api/walks/:id
 * @desc Update a walk (title, notes)
 * @access Private
 */
router.patch("/:id", walksController.updateWalk);

/**
 * @route DELETE /api/walks/:id
 * @desc Delete a walk
 * @access Private
 */
router.delete("/:id", walksController.deleteWalk);

module.exports = router;
