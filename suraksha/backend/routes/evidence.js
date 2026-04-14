// ─────────────────────────────────────────────
//  Suraksha — routes/evidence.js
// ─────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const {
  uploadEvidence,
  getEvidenceByComplaint,
  updateBlockchainTx,
} = require('../controllers/evidenceController');

// Multer: store file in memory so we can hash + forward to IPFS
const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/ogg', 'audio/wav',
      'video/mp4',  'video/webm',
      'application/pdf',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// POST /api/evidence/upload
router.post('/upload', upload.single('file'), uploadEvidence);

// GET /api/evidence/:complaintId
router.get('/:complaintId', getEvidenceByComplaint);

// PATCH /api/evidence/:id/blockchain  (Phase 5)
router.patch('/:id/blockchain', updateBlockchainTx);

module.exports = router;