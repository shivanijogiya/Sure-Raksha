// ─────────────────────────────────────────────
//  Suraksha — routes/safety.js
// ─────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const { validateFlag, validateCoordQuery } = require('../middleware/validate');
const {
  getScore,
  getHeatmap,
  flagLocation,
  predictRisk,
} = require('../controllers/safetyController');
const { getRouteSafety, getLocationTags } = require('../controllers/safetyRouteController');

// GET /api/safety/score?lat=&lng=
router.get('/score', validateCoordQuery, getScore);

// GET /api/safety/heatmap
router.get('/heatmap', getHeatmap);

// POST /api/safety/flag
router.post('/flag', validateFlag, flagLocation);

// GET /api/safety/predict?lat=&lng=
router.get('/predict', validateCoordQuery, predictRisk);

// GET /api/safety/route?from=&to=
router.get('/route', getRouteSafety);

// GET /api/safety/tags?lat=&lng=
router.get('/tags', getLocationTags);

module.exports = router;