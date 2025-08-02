const mongoose = require("mongoose");

const petSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  type: { type: String, required: true },
  birthDate: { type: Date },
  profilePictureUrl: { type: String },

  expenses: [
    {
      description: String,
      amount: Number,
      date: Date,
      category: String,
    },
  ],

  reminders: [
    {
      title: String,
      date: Date,
      isCompleted: { type: Boolean, default: false },
    },
  ],

  medicalRecords: [
    {
      recordName: String,
      recordType: String,
      date: Date,
      fileUrl: String,
    },
  ],
});

const Pet = mongoose.model("Pet", petSchema);

module.exports = Pet;
