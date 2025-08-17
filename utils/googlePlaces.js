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

  console.log("🌐 Google Places POST request:", {
    url,
    path,
    fieldMask,
    hasSessionToken: !!sessionToken,
  });

  try {
    const response = await axios.post(url, body, {
      headers,
      validateStatus: () => true,
    });
    console.log("✅ Google Places POST response:", {
      status: response.status,
      hasData: !!response.data,
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

  console.log("🌐 Google Places GET request:", {
    url,
    path,
    fieldMask,
    params,
    hasSessionToken: !!sessionToken,
  });

  try {
    const response = await axios.get(url, {
      headers,
      params,
      validateStatus: () => true,
    });
    console.log("✅ Google Places GET response:", {
      status: response.status,
      hasData: !!response.data,
    });
    return response;
  } catch (error) {
    console.error("❌ Google Places GET error:", error.message);
    throw error;
  }
}

module.exports = {
  post,
  get,
  setCache,
  getCache,
};
