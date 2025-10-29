const { Walk } = require("../models/walkModel");
const { detectWalkPOIs } = require("../utils/googlePlaces");
const { registerEventInternal } = require("../utils/gamificationService");

// Haversine formula to calculate distance between two lat/lng points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// Calculate total distance from a route array
function calculateTotalDistance(route) {
  let totalDistance = 0;
  if (route && route.length > 1) {
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += calculateDistance(
        route[i].lat,
        route[i].lng,
        route[i + 1].lat,
        route[i + 1].lng
      );
    }
  }
  return totalDistance;
}

// Calculate total duration from a route array
function calculateTotalDuration(route) {
  if (!route || route.length < 2) return 0;
  const startTime = new Date(route[0].timestamp);
  const endTime = new Date(route[route.length - 1].timestamp);
  return (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
}

// Check if current location is near the start point
function isNearStartPoint(currentLocation, startLocation, radius = 30) {
  if (!currentLocation || !startLocation) return false;
  const dist = calculateDistance(
    currentLocation.lat,
    currentLocation.lng,
    startLocation.lat,
    startLocation.lng
  );
  return dist <= radius;
}

// Check if stopped for a certain duration near the start point
function isStoppedForDuration(route, startLocation, stopDuration = 300, radius = 30) {
  if (!route || route.length < 2) return false;

  const lastPoint = route[route.length - 1];
  if (!isNearStartPoint(lastPoint, startLocation, radius)) return false;

  let stopStartTime = lastPoint.timestamp;
  for (let i = route.length - 2; i >= 0; i--) {
    const point = route[i];
    if (isNearStartPoint(point, startLocation, radius)) {
      stopStartTime = point.timestamp;
    } else {
      break;
    }
  }

  const stoppedTime = (lastPoint.timestamp.getTime() - stopStartTime.getTime()) / 1000;
  return stoppedTime >= stopDuration;
}

async function detectAndAddPois(walkId, currentRoute, userId) {
  const walk = await Walk.findById(walkId);
  if (!walk) return;

  const lastPoint = currentRoute[currentRoute.length - 1];
  if (!lastPoint) return;

  const newPois = await detectWalkPOIs(lastPoint.lat, lastPoint.lng, 100); // Search radius 100m

  for (const newPoi of newPois) {
    // Check if this POI (by placeId) is already in the walk's pois array
    const existingPoi = walk.pois.find(
      (p) => p.placeId === newPoi.placeId
    );

    if (!existingPoi) {
      // Check if the user stopped near this POI for at least 3 minutes (180 seconds)
      const stoppedNearPoi = isStoppedForDuration(
        currentRoute,
        newPoi.location,
        180, // 3 minutes stop duration
        50 // 50 meters radius
      );

      if (stoppedNearPoi) {
        walk.pois.push({
          placeId: newPoi.placeId,
          name: newPoi.name,
          type: newPoi.type,
          location: newPoi.location,
          timestamp: lastPoint.timestamp,
          stoppedDuration: 180, // Assuming 3 minutes for now
        });
        await registerEventInternal(userId, { eventKey: "EXPLORE_NEW_POI", targetId: newPoi.placeId });
      }
    }
  }
  await walk.save();
}

async function processWalkCompletion(walkId, userId) {
  const walk = await Walk.findById(walkId);
  if (!walk) return;

  walk.endTime = new Date();
  walk.distance = calculateTotalDistance(walk.route);
  walk.duration = calculateTotalDuration(walk.route);

  // Gamification events
  await registerEventInternal(userId, { eventKey: "WALK_COMPLETED", targetId: walk._id });

  if (walk.distance >= 1000) { // 1 KM
    await registerEventInternal(userId, { eventKey: "WALK_DISTANCE_1KM", targetId: walk._id });
  }

  // TODO: Implement streak logic for WALK_STREAK_3

  await walk.save();
  return walk;
}

module.exports = {
  calculateDistance,
  calculateTotalDistance,
  calculateTotalDuration,
  isNearStartPoint,
  isStoppedForDuration,
  detectAndAddPois,
  processWalkCompletion,
};
