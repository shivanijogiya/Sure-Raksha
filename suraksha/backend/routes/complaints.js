// ─────────────────────────────────────────────
//  Suraksha — routes/complaints.js
// ─────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const { validateComplaint } = require('../middleware/validate');
const {
  fileComplaint,
  getComplaintByToken,
  updateStatus,
} = require('../controllers/complaintController');

// POST /api/complaints
router.post('/', validateComplaint, fileComplaint);

// GET /api/complaints/:token
router.get('/:token', getComplaintByToken);

// PATCH /api/complaints/:token/status  (internal/admin)
router.patch('/:token/status', updateStatus);

module.exports = router;