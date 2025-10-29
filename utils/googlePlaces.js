// utils/googlePlaces.js
// Small helper for Google Places (New) REST v1 + simple in‑memory cache

const axios = require("axios");

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error(
    "❌ [googlePlaces] Missing GOOGLE_MAPS_API_KEY in environment."
  );
  console.error(
    "❌ [googlePlaces] Please set GOOGLE_MAPS_API_KEY in your .env file"
  );
} else {
  console.log(
    "✅ [googlePlaces] Google Maps API key found:",
    GOOGLE_API_KEY.substring(0, 10) + "..."
  );
}

const BASE_URL = "https://places.googleapis.com/v1";

// --- tiny in-memory cache with TTL ---
const cache = new Map();
/**
 * setCache(key, value, ttlMs)
 */
function setCache(key, value, ttlMs = 15 * 60 * 1000) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}
/**
 * getCache(key)
 */
function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

async function post(path, body, fieldMask, sessionToken) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_API_KEY,
  };
  if (sessionToken) headers["X-Goog-Session-Token"] = sessionToken;
  if (fieldMask) headers["X-Goog-FieldMask"] = fieldMask;

  try {
    const response = await axios.post(url, body, {
      headers,
      validateStatus: () => true,
    });
    return response;
  } catch (error) {
    console.error("❌ Google Places POST error:", error.message);
    throw error;
  }
}

async function get(path, fieldMask, sessionToken, params = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "X-Goog-Api-Key": GOOGLE_API_KEY,
  };
  if (sessionToken) headers["X-Goog-Session-Token"] = sessionToken;
  if (fieldMask) headers["X-Goog-FieldMask"] = fieldMask;

  try {
    const response = await axios.get(url, {
      headers,
      params,
      validateStatus: () => true,
    });
    return response;
  } catch (error) {
    console.error("❌ Google Places GET error:", error.message);
    throw error;
  }
}

/**
 * Detect POIs near a location for walk tracking
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radius - Search radius in meters (default: 100)
 * @returns {Array} Array of POIs relevant for pet walks
 */
async function detectWalkPOIs(lat, lng, radius = 100) {
  const cacheKey = `walk_pois_${lat}_${lng}_${radius}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await post("/places:searchNearby", {
      includedTypes: [
        "park",
        "veterinary_care",
        "pet_store"
      ],
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radius
        }
      }
    }, "places.displayName,places.types,places.location,places.id");

    if (response.status !== 200) {
      console.error("❌ Google Places search error:", response.status, response.data);
      return [];
    }

    const pois = response.data.places?.map(place => ({
      type: mapGoogleTypeToWalkType(place.types),
      name: place.displayName?.text || "Unknown",
      placeId: place.id,
      location: {
        lat: place.location?.latitude || lat,
        lng: place.location?.longitude || lng
      }
    })).filter(poi => poi.type !== null) || [];

    setCache(cacheKey, pois, 30 * 60 * 1000); // Cache for 30 minutes
    return pois;

  } catch (error) {
    console.error("❌ Error detecting walk POIs:", error.message);
    return [];
  }
}

/**
 * Map Google Places types to walk POI types
 * @param {Array} googleTypes - Google Places types
 * @returns {string|null} Walk POI type or null if not relevant
 */
function mapGoogleTypeToWalkType(googleTypes) {
  if (!googleTypes || !Array.isArray(googleTypes)) return null;

  const typeMap = {
    'park': 'park',
    'veterinary_care': 'vet',
    'pet_store': 'pet_store'
  };

  for (const googleType of googleTypes) {
    if (typeMap[googleType]) {
      return typeMap[googleType];
    }
  }

  return null;
}

/**
 * Get POI details by place ID
 * @param {string} placeId - Google Place ID
 * @returns {Object|null} POI details
 */
async function getPOIDetails(placeId) {
  const cacheKey = `poi_details_${placeId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await get(`/places/${placeId}`,
      "id,displayName,types,location,formattedAddress,rating,userRatingCount"
    );

    if (response.status !== 200) {
      console.error("❌ Google Places details error:", response.status, response.data);
      return null;
    }

    const place = response.data;
    const poiDetails = {
      placeId: place.id,
      name: place.displayName?.text || "Unknown",
      type: mapGoogleTypeToWalkType(place.types),
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0
      },
      address: place.formattedAddress || "",
      rating: place.rating || 0,
      ratingCount: place.userRatingCount || 0
    };

    setCache(cacheKey, poiDetails, 60 * 60 * 1000); // Cache for 1 hour
    return poiDetails;

  } catch (error) {
    console.error("❌ Error getting POI details:", error.message);
    return null;
  }
}

module.exports = {
  post,
  get,
  setCache,
  getCache,
  detectWalkPOIs,
  mapGoogleTypeToWalkType,
  getPOIDetails,
};
