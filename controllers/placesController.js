// controllers/placesController.js
// Proxy endpoints for Google Places (New) with field masks, caching, curated pet categories

const { post, get, setCache, getCache, detectWalkPOIs } = require("../utils/googlePlaces");

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
      "וטרינר OR מרפאה וטרינרית OR וטרינרית OR וטרינריה OR מרפאת חיות OR בית חולים וטרינרי OR emergency vet OR vet clinic OR pet clinic OR animal hospital OR veterinarian",
  },

  // Nearby-valid types
  // Broaden coverage by using mixed + text synonyms in HE/EN
  pet_stores: {
    mode: "mixed",
    types: ["pet_store"],
    query:
      "חנות חיות OR חנות לבעלי חיים OR ציוד לחיות מחמד OR pet shop OR pet store",
  },
  dog_parks: {
    mode: "mixed",
    types: ["dog_park"],
    query: "גן כלבים OR dog park",
  },

  // Text search only (no official types allowed in Nearby)
  groomers: {
    mode: "text",
    query:
      "מספרת כלבים OR מספרת לחיות מחמד OR ספר כלבים OR טיפוח כלבים OR grooming OR dog groomer OR pet grooming",
  },
  boarding: {
    mode: "text",
    query:
      "פנסיון לכלבים OR אירוח לכלבים OR מלון כלבים OR דוגי דייקייר OR daycare כלבים OR dog boarding OR dog daycare OR pet hotel",
  },
  trainers: {
    mode: "text",
    query:
      "מאלף כלבים OR אילוף כלבים OR קורס אילוף OR dog training OR pet trainer",
  },
  shelters: {
    mode: "mixed",
    types: ["animal_shelter"],
    query:
      "עמותת בעלי חיים OR הצלת בעלי חיים OR אימוץ כלבים OR animal shelter OR pet adoption",
  },
};

// Name-based synonyms per category (he/en) to complement types filtering
const CATEGORY_NAME_SYNONYMS = {
  vets: ["וטרינר", "וטרינרית", "וטרינריה", "vet", "veterinarian", "clinic"],
  pet_stores: [
    "חנות חיות",
    "חנות לבעלי חיים",
    "ציוד לחיות",
    "pet shop",
    "pet store",
  ],
  dog_parks: ["גן כלבים", "dog park"],
  groomers: ["מספרת כלבים", "ספר כלבים", "groom", "groomer", "grooming"],
  boarding: ["פנסיון", "מלון כלבים", "אירוח", "boarding", "daycare", "hotel"],
  trainers: ["מאלף", "אילוף", "training", "trainer"],
  shelters: ["עמותה", "אימוץ", "shelter", "adoption", "rescue"],
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
  const max = Math.min(+maxResults || 20, 50);
  const radiusNum = Math.min(+radius || 5000, 50000);

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

  const results = await Promise.allSettled([...nearbyJobs, ...textJobs]);

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

    for (const p of arr) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      places.push(p);
      if (places.length >= max) break;
    }
    if (places.length >= max) break;
  }

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
    const maxNum = Math.min(+maxResults || 20, 50);

    // default: if no q/category/petCategory => all_pets
    const effectivePetCategory =
      petCategory || (!q && !category ? "all_pets" : undefined);

    const cacheKey = `search:${q || ""}:${category || ""}:${
      effectivePetCategory || ""
    }:${lat}:${lng}:${radiusNum}:${maxNum}:${rank}:${languageCode}`;
    const cached = getCache(cacheKey);
    // If there's a free‑text query, bypass cache to reflect user input immediately
    if (!q && cached) {
      return res.json(cached);
    }

    let responseData; // ensure declared

    const normalize = (s = "") => String(s || "").toLowerCase();
    const matchesQuery = (place, query) => {
      if (!query) return true;
      const ql = normalize(query);
      const name = normalize(place?.displayName?.text);
      const address = normalize(place?.formattedAddress);
      const types = Array.isArray(place?.types)
        ? place.types.map((t) => normalize(t)).join(" ")
        : "";
      return name.includes(ql) || address.includes(ql) || types.includes(ql);
    };

    if (effectivePetCategory === "all_pets") {
      responseData = await aggregateAllPets({
        lat,
        lng,
        radius: radiusNum,
        regionCode,
        languageCode,
        sessionToken,
        maxResults: maxNum,
      });
      // initial filter applied later (uniformly for all modes)
    } else if (effectivePetCategory && PET_CATEGORY_MAP[effectivePetCategory]) {
      const rule = PET_CATEGORY_MAP[effectivePetCategory];

      if (rule.mode === "nearby") {
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
      } else if (rule.mode === "text") {
        const resp = await post(
          "/places:searchText",
          {
            textQuery: q ? `${q} ${rule.query}` : rule.query,
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
      } else if (rule.mode === "mixed") {
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
              textQuery: q ? `${q} ${rule.query}` : rule.query,
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
      }
    } else if (q && !category) {
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
    } else {
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
    }

    // Final category guard + name-focused filtering and ranking
    if (Array.isArray(responseData?.places)) {
      // Enforce category-specific type constraints to reduce mismatches
      const enforceCategory = (place) => {
        if (!effectivePetCategory) return true;
        const types = Array.isArray(place?.types) ? place.types : [];
        const tset = new Set(types);
        const name = String(place?.displayName?.text || "").toLowerCase();
        const hasNameSyn = (cat) =>
          (CATEGORY_NAME_SYNONYMS[cat] || []).some((w) =>
            name.includes(String(w).toLowerCase())
          );
        switch (effectivePetCategory) {
          case "vets":
            return (
              types.some((t) => /veterinar|veterinary/i.test(t)) ||
              hasNameSyn("vets")
            );
          case "pet_stores":
            return tset.has("pet_store") || hasNameSyn("pet_stores");
          case "dog_parks":
            return tset.has("dog_park") || hasNameSyn("dog_parks");
          case "groomers":
            return /groom/i.test(types.join(" ")) || hasNameSyn("groomers");
          case "boarding":
            return (
              /boarding|hotel/i.test(types.join(" ")) || hasNameSyn("boarding")
            );
          case "trainers":
            return /train/i.test(types.join(" ")) || hasNameSyn("trainers");
          case "shelters":
            return (
              /shelter|adoption/i.test(types.join(" ")) ||
              hasNameSyn("shelters")
            );
          default:
            return true;
        }
      };

      responseData.places = responseData.places.filter(enforceCategory);
    }

    if (q && Array.isArray(responseData?.places)) {
      const ql = normalize(q);
      const nameIncludes = (p) => normalize(p?.displayName?.text).includes(ql);
      const addrTypesInclude = (p) => matchesQuery(p, q);

      let places = responseData.places || [];
      const nameMatches = places.filter(nameIncludes);
      if (nameMatches.length > 0) {
        places = nameMatches;
      } else {
        // fallback: allow address/types matches only if there are no name matches at all
        places = places.filter(addrTypesInclude);
      }

      // Rank: name startsWith > name includes > others (already filtered), then rating desc
      const score = (p) => {
        const name = normalize(p?.displayName?.text);
        if (name.startsWith(ql)) return 3;
        if (name.includes(ql)) return 2;
        return 1;
      };
      places = places
        .map((p) => ({ p, s: score(p) }))
        .sort((a, b) => b.s - a.s || (b.p?.rating || 0) - (a.p?.rating || 0))
        .map((x) => x.p)
        .slice(0, maxNum);

      responseData = { places };
    }

    // If vets selected and results are sparse, try a fallback expanded search (larger radius)
    if (
      effectivePetCategory === "vets" &&
      Array.isArray(responseData?.places) &&
      responseData.places.length < Math.min(+maxResults || 20, 50) / 3
    ) {
      try {
        const fallbackRadius = Math.min(radiusNum * 2, 50000);
        const rule = PET_CATEGORY_MAP.vets;
        const [fa, fb] = await Promise.allSettled([
          post(
            "/places:searchNearby",
            {
              includedTypes: rule.types,
              locationRestriction: {
                circle: {
                  center: { latitude: +lat, longitude: +lng },
                  radius: fallbackRadius,
                },
              },
              rankPreference: rank === "distance" ? "DISTANCE" : "POPULARITY",
              maxResultCount: Math.min(maxNum, 50),
              regionCode,
              languageCode,
            },
            LIST_FIELD_MASK,
            sessionToken
          ),
          post(
            "/places:searchText",
            {
              textQuery: q ? `${q} ${rule.query}` : rule.query,
              locationBias: {
                circle: {
                  center: { latitude: +lat, longitude: +lng },
                  radius: fallbackRadius,
                },
              },
              maxResultCount: Math.min(maxNum, 50),
              regionCode,
              languageCode,
            },
            LIST_FIELD_MASK,
            sessionToken
          ),
        ]);
        const seen = new Set(responseData.places.map((p) => p.id));
        for (const r of [fa, fb]) {
          if (r.status !== "fulfilled") continue;
          const arr = r.value?.data?.places || [];
          for (const p of arr) {
            if (!p?.id || seen.has(p.id)) continue;
            seen.add(p.id);
            responseData.places.push(p);
            if (responseData.places.length >= maxNum) break;
          }
          if (responseData.places.length >= maxNum) break;
        }
      } catch {}
    }

    // Cache only after final filtering
    setCache(cacheKey, responseData, TTL_SEARCH_MS);

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
 * GET /api/places/nearby?lat=...&lng=...&radius=...
 * For walk tracking POI detection
 */
exports.nearby = async (req, res) => {
  try {
    const { lat, lng, radius = 100 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    
    const pois = await detectWalkPOIs(+lat, +lng, +radius);
    return res.json({ pois });
  } catch (err) {
    console.error("❌ Nearby POIs error:", err);
    return res.status(500).json({
      error: "Failed to fetch nearby POIs",
      message: err?.message,
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
