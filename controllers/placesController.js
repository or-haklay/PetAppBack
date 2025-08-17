// controllers/placesController.js
// Proxy endpoints for Google Places (New) with field masks, caching, curated pet categories

const { post, get, setCache, getCache } = require("../utils/googlePlaces");

// --- Field masks (lean responses) ---
const LIST_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.currentOpeningHours.openNow",
  "places.photos",
  "places.googleMapsUri",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryType",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "currentOpeningHours",
  "regularOpeningHours",
  "rating",
  "userRatingCount",
  "reviews",
  "photos",
  "priceLevel",
].join(",");

// --- TTLs ---
const TTL_SEARCH_MS = 15 * 60 * 1000; // 15m
const TTL_DETAILS_MS = 20 * 60 * 1000; // 20m

// --- Curated pet categories ---
const PET_CATEGORY_MAP = {
  // mixed: combine Nearby(type) + Text(keywords) to improve coverage
  vets: {
    mode: "mixed",
    types: ["veterinary_care"],
    query:
      "וטרינר OR מרפאה וטרינרית OR וטרינרית OR emergency vet OR vet clinic",
  },

  // Nearby-valid types
  pet_stores: { mode: "nearby", types: ["pet_store"] },
  dog_parks: { mode: "nearby", types: ["dog_park"] },

  // Text search only (no official types allowed in Nearby)
  groomers: {
    mode: "text",
    query: "מספרת כלבים OR מספרת לחיות מחמד OR dog groomer OR pet grooming",
  },
  boarding: {
    mode: "text",
    query:
      "פנסיון לכלבים OR דוגי דייקייר OR dog boarding OR dog daycare OR pet hotel",
  },
  sitters: {
    mode: "text",
    query: "דוג סיטר OR דוג ווקר OR dog sitter OR pet sitter OR dog walker",
  },
  trainers: {
    mode: "text",
    query: "מאלף כלבים OR אילוף כלבים OR dog training OR pet trainer",
  },
  shelters: {
    mode: "text",
    query: "עמותת בעלי חיים OR אימוץ כלבים OR animal shelter OR pet adoption",
  },
};

// --- Helper: aggregate “all_pets” (multiple queries merged) ---
async function aggregateAllPets({
  lat,
  lng,
  radius,
  regionCode,
  languageCode,
  sessionToken,
  maxResults,
}) {
  console.log("🐾 Starting aggregateAllPets with:", {
    lat,
    lng,
    radius,
    maxResults,
  });

  const max = Math.min(+maxResults || 20, 20);
  const radiusNum = Math.min(+radius || 5000, 50000);

  console.log(
    "🔍 Creating nearby jobs for types: veterinary_care, pet_store, dog_park"
  );
  const nearbyJobs = [
    post(
      "/places:searchNearby",
      {
        includedTypes: ["veterinary_care"],
        locationRestriction: {
          circle: {
            center: { latitude: +lat, longitude: +lng },
            radius: radiusNum,
          },
        },
        rankPreference: "POPULARITY",
        maxResultCount: max,
        regionCode,
        languageCode,
      },
      LIST_FIELD_MASK,
      sessionToken
    ),
    post(
      "/places:searchNearby",
      {
        includedTypes: ["pet_store"],
        locationRestriction: {
          circle: {
            center: { latitude: +lat, longitude: +lng },
            radius: radiusNum,
          },
        },
        rankPreference: "POPULARITY",
        maxResultCount: max,
        regionCode,
        languageCode,
      },
      LIST_FIELD_MASK,
      sessionToken
    ),
    post(
      "/places:searchNearby",
      {
        includedTypes: ["dog_park"],
        locationRestriction: {
          circle: {
            center: { latitude: +lat, longitude: +lng },
            radius: radiusNum,
          },
        },
        rankPreference: "POPULARITY",
        maxResultCount: max,
        regionCode,
        languageCode,
      },
      LIST_FIELD_MASK,
      sessionToken
    ),
  ];

  console.log("🔍 Creating text jobs for grooming, boarding, training");
  const textJobs = [
    post(
      "/places:searchText",
      {
        textQuery: "dog groomer OR pet grooming",
        locationBias: {
          circle: {
            center: { latitude: +lat, longitude: +lng },
            radius: radiusNum,
          },
        },
        maxResultCount: max,
        regionCode,
        languageCode,
      },
      LIST_FIELD_MASK,
      sessionToken
    ),
    post(
      "/places:searchText",
      {
        textQuery: "dog boarding OR pet boarding OR dog daycare OR pet hotel",
        locationBias: {
          circle: {
            center: { latitude: +lat, longitude: +lng },
            radius: radiusNum,
          },
        },
        maxResultCount: max,
        regionCode,
        languageCode,
      },
      LIST_FIELD_MASK,
      sessionToken
    ),
    post(
      "/places:searchText",
      {
        textQuery: "dog training OR pet trainer",
        locationBias: {
          circle: {
            center: { latitude: +lat, longitude: +lng },
            radius: radiusNum,
          },
        },
        maxResultCount: max,
        regionCode,
        languageCode,
      },
      LIST_FIELD_MASK,
      sessionToken
    ),
  ];

  console.log("🚀 Executing all jobs with Promise.allSettled...");
  const results = await Promise.allSettled([...nearbyJobs, ...textJobs]);

  console.log("📊 Processing results...");
  const seen = new Set();
  const places = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const jobType = i < nearbyJobs.length ? "nearby" : "text";
    const jobIndex = i < nearbyJobs.length ? i : i - nearbyJobs.length;

    if (r.status !== "fulfilled") {
      console.error(`❌ ${jobType} job ${jobIndex} failed:`, r.reason);
      continue;
    }

    const arr = r.value?.data?.places || [];
    console.log(
      `✅ ${jobType} job ${jobIndex} succeeded, found ${arr.length} places`
    );

    for (const p of arr) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      places.push(p);
      if (places.length >= max) break;
    }
    if (places.length >= max) break;
  }

  console.log(
    "🎯 AggregateAllPets complete, returning",
    places.length,
    "unique places"
  );
  return { places };
}

/**
 * GET /api/places/search
 * q? petCategory? category? lat,lng required
 */
exports.search = async (req, res) => {
  try {
    const {
      q,
      category, // legacy
      petCategory, // curated
      lat,
      lng,
      radius = 5000,
      sessionToken,
      maxResults = 20,
      rank = "relevance",
      regionCode = "IL",
      languageCode = "he",
    } = req.query;

    console.log("🔍 Places search request:", {
      q,
      category,
      petCategory,
      lat,
      lng,
      radius,
      maxResults,
      rank,
      regionCode,
      languageCode,
    });

    if (!lat || !lng) {
      console.error("❌ Missing lat/lng in places search");
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const radiusNum = Math.min(+radius || 5000, 50000);
    const maxNum = Math.min(+maxResults || 20, 20);

    // default: if no q/category/petCategory => all_pets
    const effectivePetCategory =
      petCategory || (!q && !category ? "all_pets" : undefined);

    console.log("🎯 Effective pet category:", effectivePetCategory);

    const cacheKey = `search:${q || ""}:${category || ""}:${
      effectivePetCategory || ""
    }:${lat}:${lng}:${radiusNum}:${maxNum}:${rank}:${languageCode}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log("✅ Returning cached result for key:", cacheKey);
      return res.json(cached);
    }

    let responseData; // ensure declared

    console.log(
      "🔍 Starting places search with category:",
      effectivePetCategory
    );

    if (effectivePetCategory === "all_pets") {
      console.log("🐾 Aggregating all pets...");
      responseData = await aggregateAllPets({
        lat,
        lng,
        radius: radiusNum,
        regionCode,
        languageCode,
        sessionToken,
        maxResults: maxNum,
      });
      console.log(
        "✅ All pets aggregation complete, found:",
        responseData?.places?.length || 0
      );
    } else if (effectivePetCategory && PET_CATEGORY_MAP[effectivePetCategory]) {
      const rule = PET_CATEGORY_MAP[effectivePetCategory];
      console.log("🏷️ Using pet category rule:", rule);

      if (rule.mode === "nearby") {
        console.log("📍 Using nearby search for types:", rule.types);
        const resp = await post(
          "/places:searchNearby",
          {
            includedTypes: rule.types,
            locationRestriction: {
              circle: {
                center: { latitude: +lat, longitude: +lng },
                radius: radiusNum,
              },
            },
            rankPreference: rank === "distance" ? "DISTANCE" : "POPULARITY",
            maxResultCount: maxNum,
            regionCode,
            languageCode,
          },
          LIST_FIELD_MASK,
          sessionToken
        );
        responseData = resp.data;
        console.log(
          "✅ Nearby search complete, found:",
          responseData?.places?.length || 0
        );
      } else if (rule.mode === "text") {
        console.log("📝 Using text search with query:", rule.query);
        const resp = await post(
          "/places:searchText",
          {
            textQuery: rule.query,
            locationBias: {
              circle: {
                center: { latitude: +lat, longitude: +lng },
                radius: radiusNum,
              },
            },
            maxResultCount: maxNum,
            regionCode,
            languageCode,
          },
          LIST_FIELD_MASK,
          sessionToken
        );
        responseData = resp.data;
        console.log(
          "✅ Text search complete, found:",
          responseData?.places?.length || 0
        );
      } else if (rule.mode === "mixed") {
        console.log("🔄 Using mixed search (nearby + text)");
        // combine Nearby + Text for better coverage
        const [a, b] = await Promise.allSettled([
          post(
            "/places:searchNearby",
            {
              includedTypes: rule.types,
              locationRestriction: {
                circle: {
                  center: { latitude: +lat, longitude: +lng },
                  radius: radiusNum,
                },
              },
              rankPreference: rank === "distance" ? "DISTANCE" : "POPULARITY",
              maxResultCount: maxNum,
              regionCode,
              languageCode,
            },
            LIST_FIELD_MASK,
            sessionToken
          ),
          post(
            "/places:searchText",
            {
              textQuery: rule.query,
              locationBias: {
                circle: {
                  center: { latitude: +lat, longitude: +lng },
                  radius: radiusNum,
                },
              },
              maxResultCount: maxNum,
              regionCode,
              languageCode,
            },
            LIST_FIELD_MASK,
            sessionToken
          ),
        ]);

        const merged = [];
        const seen = new Set();
        for (const r of [a, b]) {
          if (r.status !== "fulfilled") continue;
          const arr = r.value?.data?.places || [];
          for (const p of arr) {
            if (!p?.id || seen.has(p.id)) continue;
            seen.add(p.id);
            merged.push(p);
            if (merged.length >= maxNum) break;
          }
          if (merged.length >= maxNum) break;
        }
        responseData = { places: merged };
        console.log(
          "✅ Mixed search complete, found:",
          responseData?.places?.length || 0
        );
      }
    } else if (q && !category) {
      console.log("🔍 Using free text search with query:", q);
      // free text fallback
      const resp = await post(
        "/places:searchText",
        {
          textQuery: q,
          locationBias: {
            circle: {
              center: { latitude: +lat, longitude: +lng },
              radius: radiusNum,
            },
          },
          maxResultCount: maxNum,
          regionCode,
          languageCode,
        },
        LIST_FIELD_MASK,
        sessionToken
      );
      responseData = resp.data;
      console.log(
        "✅ Free text search complete, found:",
        responseData?.places?.length || 0
      );
    } else {
      console.log("🏷️ Using legacy category search with category:", category);
      // legacy type
      const includedTypes = category ? [category] : undefined;
      const resp = await post(
        "/places:searchNearby",
        {
          includedTypes,
          locationRestriction: {
            circle: {
              center: { latitude: +lat, longitude: +lng },
              radius: radiusNum,
            },
          },
          rankPreference: rank === "distance" ? "DISTANCE" : "POPULARITY",
          maxResultCount: maxNum,
          regionCode,
          languageCode,
        },
        LIST_FIELD_MASK,
        sessionToken
      );
      responseData = resp.data;
      console.log(
        "✅ Legacy category search complete, found:",
        responseData?.places?.length || 0
      );
    }

    console.log("💾 Caching result with key:", cacheKey);
    setCache(cacheKey, responseData, TTL_SEARCH_MS);

    console.log(
      "✅ Places search successful, returning:",
      responseData?.places?.length || 0,
      "places"
    );
    return res.json(responseData);
  } catch (err) {
    console.error("💥 Places search error:", err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || {
      message: err?.message,
      stack: err?.stack,
    };
    console.error("[Places search error]", status, data);
    return res.status(status).json({
      error: "Places search failed",
      status,
      data,
    });
  }
};

/**
 * GET /api/places/details/:placeId
 */
exports.details = async (req, res) => {
  try {
    const { placeId } = req.params;
    const { sessionToken, languageCode = "he", regionCode = "IL" } = req.query;
    if (!placeId) return res.status(400).json({ error: "placeId is required" });

    const cacheKey = `details:${placeId}:${languageCode}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const response = await get(
      `/places/${encodeURIComponent(placeId)}`,
      DETAILS_FIELD_MASK,
      sessionToken,
      { languageCode, regionCode }
    );

    const data = response.data || {};
    setCache(cacheKey, data, TTL_DETAILS_MS);
    return res.json(data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || {
      message: err?.message,
      stack: err?.stack,
    };
    console.error("[Places details error]", status, data);
    return res.status(status).json({
      error: "Places details failed",
      status,
      data,
    });
  }
};

/**
 * GET /api/places/photo?name=...&maxWidthPx=...
 */
exports.photo = async (req, res) => {
  try {
    const { name, maxWidthPx = 800 } = req.query;
    if (!name) return res.status(400).json({ error: "name is required" });

    const axios = require("axios");
    const url = `https://places.googleapis.com/v1/${encodeURI(
      name
    )}/media?maxWidthPx=${+maxWidthPx}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url, { responseType: "arraybuffer" });
    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    return res.send(response.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || {
      message: err?.message,
      stack: err?.stack,
    };
    console.error("[Places photo error]", status, data);
    return res.status(status).json({
      error: "Places photo failed",
      status,
      data,
    });
  }
};
