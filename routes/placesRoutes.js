// routes/placesRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/placesController");

// /api/places/search?q=...&category=...&lat=...&lng=...&radius=...&sessionToken=...
router.get("/search", ctrl.search);

// /api/places/details/:placeId?sessionToken=...
router.get("/details/:placeId", ctrl.details);

// /api/places/photo?name=places/.../photos/...&maxWidthPx=800
router.get("/photo", ctrl.photo);

module.exports = router;
