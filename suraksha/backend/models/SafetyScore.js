// ─────────────────────────────────────────────
//  Suraksha — models/SafetyScore.js
// ─────────────────────────────────────────────
const mongoose = require('mongoose');

const SafetyScoreSchema = new mongoose.Schema(
  {
    locationName:   { type: String, default: '' },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    score:          { type: Number, min: 0, max: 100, default: 100 },
    incidentCount:  { type: Number, default: 0 },
    lightingRating: { type: Number, min: 1, max: 5, default: 3 },
    crowdDensity:   { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    lastIncidentAt: { type: Date, default: null },
    riskTags:       [{ type: String, enum: ['harassment-prone', 'stalking-prone', 'poor-lighting', 'isolated'] }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SafetyScore', SafetyScoreSchema);