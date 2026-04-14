//routes/report.js
const express = require('express');
const router  = express.Router();
const { generateReport } = require('../controllers/reportController');

// POST /api/report/generate
// Body: { token, laws[] }
// Returns: PDF stream
router.post('/generate', generateReport);

module.exports = router;