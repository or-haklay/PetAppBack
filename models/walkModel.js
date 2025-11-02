const mongoose = require("mongoose");
const Joi = require("joi");

const POISchema = new mongoose.Schema({
  placeId: { type: String, required: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: [
      "park",
      "vet",
      "pet_store",
      "water",
      "groomer",
      "boarding",
      "other",
    ],
    default: "other",
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  timestamp: { type: Date, default: Date.now },
  stoppedDuration: { type: Number, default: 0 }, // in seconds
});

const WalkSchema = new mongoose.Schema(
  {
    petId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    distance: { type: Number, default: 0 }, // in meters
    duration: { type: Number, default: 0 }, // in seconds
    route: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        timestamp: { type: Date, default: Date.now },
        accuracy: { type: Number }, // in meters
      },
    ],
    pois: [POISchema],
    title: { type: String },
    isAutoCompleted: { type: Boolean, default: false },
    isShared: { type: Boolean, default: false },
    gamificationEvents: [
      {
        eventKey: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Future features (for schema completeness)
    photos: [{ type: String }], // URLs to photos taken during the walk
    notes: { type: String },
    mood: { type: String }, // e.g., "happy", "energetic", "calm"
    terrainType: { type: String }, // e.g., "urban", "park", "beach"
    averageSpeed: { type: Number }, // in m/s
    calories: { type: Number }, // estimated calories burned
    elevation: { type: Number }, // total elevation gain/loss
    weather: { type: String }, // e.g., "sunny", "rainy", "cloudy"
  },
  {
    timestamps: true,
  }
);

WalkSchema.index({ petId: 1, startTime: -1 });
WalkSchema.index({ userId: 1, startTime: -1 });

const Walk = mongoose.model("Walk", WalkSchema, "walks");

const createWalkSchema = Joi.object({
  petId: Joi.string().required(),
  pet: Joi.object().allow(null),
  startTime: Joi.date().required(),
  route: Joi.array().items(
    Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      timestamp: Joi.date(),
      accuracy: Joi.number(),
    })
  ),
  pois: Joi.array().items(
    Joi.object({
      placeId: Joi.string().required(),
      name: Joi.string().required(),
      type: Joi.string().valid(
        "park",
        "vet",
        "pet_store",
        "water",
        "groomer",
        "boarding",
        "other"
      ),
      location: Joi.object({
        lat: Joi.number().required(),
        lng: Joi.number().required(),
      }).required(),
      timestamp: Joi.date(),
      stoppedDuration: Joi.number(),
    })
  ),
  title: Joi.string().allow("", null),
  isAutoCompleted: Joi.boolean(),
  isShared: Joi.boolean(),
  distance: Joi.number().min(0).allow(0),
  duration: Joi.number().min(0),
  endTime: Joi.date(),
});

const updateWalkSchema = Joi.object({
  endTime: Joi.date(),
  distance: Joi.number().min(0),
  duration: Joi.number().min(0),
  route: Joi.array().items(
    Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      timestamp: Joi.date(),
      accuracy: Joi.number(),
    })
  ),
  pois: Joi.array().items(
    Joi.object({
      placeId: Joi.string().required(),
      name: Joi.string().required(),
      type: Joi.string().valid(
        "park",
        "vet",
        "pet_store",
        "water",
        "groomer",
        "boarding",
        "other"
      ),
      location: Joi.object({
        lat: Joi.number().required(),
        lng: Joi.number().required(),
      }).required(),
      timestamp: Joi.date(),
      stoppedDuration: Joi.number(),
    })
  ),
  title: Joi.string().allow("", null),
  isAutoCompleted: Joi.boolean(),
  isShared: Joi.boolean(),
  gamificationEvents: Joi.array().items(
    Joi.object({
      eventKey: Joi.string().required(),
      timestamp: Joi.date(),
    })
  ),
  photos: Joi.array().items(Joi.string()),
  notes: Joi.string().allow("", null),
  mood: Joi.string().allow("", null),
  terrainType: Joi.string().allow("", null),
  averageSpeed: Joi.number().min(0),
  calories: Joi.number().min(0),
  elevation: Joi.number(),
  weather: Joi.string().allow("", null),
});

module.exports = {
  Walk,
  createWalkSchema,
  updateWalkSchema,
};
