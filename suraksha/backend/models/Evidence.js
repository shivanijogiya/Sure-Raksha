// ─────────────────────────────────────────────
//  Suraksha — models/Evidence.js
// ─────────────────────────────────────────────
const mongoose = require('mongoose');

const EvidenceSchema = new mongoose.Schema({
  complaintId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  fileName:       { type: String, default: '' },
  fileType:       { type: String, default: '' },
  fileSize:       { type: Number, default: 0 },
  sha256Hash:     { type: String, required: true },
  ipfsCid:        { type: String, default: null },
  blockchainTx:   { type: String, default: null },
  privacyControl: { type: String, enum: ['private', 'share-on-demand', 'public'], default: 'private' },
  uploadedAt:     { type: Date,   default: Date.now },
});

module.exports = mongoose.model('Evidence', EvidenceSchema);