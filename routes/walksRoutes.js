const express = require("express");
const router = express.Router();
const walksController = require("../controllers/walksController");
const { authMW } = require("../middleware/authMW");

// NOTE: Public routes are handled in main.js to avoid conflicts with /:petId route
// The public route /api/walks/public/:id is defined separately before this router

// Apply authentication middleware to all routes
// All routes in this file require authentication
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
// Add condition to prevent catching /public/ requests
router.get("/:petId/stats", (req, res, next) => {
  // If the petId is "public", this means /public/:id was incorrectly matched
  if (req.params.petId === 'public') {
    console.log("⚠️ [walksRoutes] Route /:petId/stats incorrectly matched /public/ request, skipping");
    return next(); // Skip to next route handler
  }
  // Otherwise, proceed with the handler
  walksController.getWalkStats(req, res, next);
});

/**
 * @route GET /api/walks/:petId
 * @desc Get all walks for a specific pet
 * @access Private
 * @query page, limit, startDate, endDate
 */
// Add condition to prevent catching /public/ requests
router.get("/:petId", (req, res, next) => {
  // If the petId is "public", this means /public/:id was incorrectly matched
  if (req.params.petId === 'public') {
    console.log("⚠️ [walksRoutes] Route /:petId incorrectly matched /public/ request, skipping");
    return next(); // Skip to next route handler
  }
  // Otherwise, proceed with the handler
  walksController.getWalksByPetId(req, res, next);
});

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
