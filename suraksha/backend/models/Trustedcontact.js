// ─────────────────────────────────────────────
//  Suraksha — models/TrustedContact.js
// ─────────────────────────────────────────────
const mongoose = require('mongoose');

const TrustedContactSchema = new mongoose.Schema(
  {
    anonymousToken: { type: String, required: true },
    name:           { type: String, required: true },
    phone:          { type: String, required: true },
    alertEnabled:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrustedContact', TrustedContactSchema);