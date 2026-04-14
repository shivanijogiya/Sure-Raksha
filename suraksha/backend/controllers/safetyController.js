// ─────────────────────────────────────────────
//  Suraksha — controllers/safetyController.js
// ─────────────────────────────────────────────
const SafetyScore = require('../models/SafetyScore');
const { calculateSafetyScore, scoreToColour } = require('../utils/safetyScore');

// Radius in degrees (~1 km ≈ 0.009°) for "nearby" lookup
const NEARBY_DELTA = 0.01;

// ── GET /api/safety/score?lat=&lng= ──────────
const getScore = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng query params are required' });
    }

    // Find nearest stored location
    const record = await SafetyScore.findOne({
      'coordinates.lat': { $gte: lat - NEARBY_DELTA, $lte: lat + NEARBY_DELTA },
      'coordinates.lng': { $gte: lng - NEARBY_DELTA, $lte: lng + NEARBY_DELTA },
    });

    if (!record) {
      // No data → return neutral score
      return res.json({
        score:  65,
        colour: 'amber',
        label:  'No data for this location',
      });
    }

    // Recalculate live (captures current time-of-day)
    const liveScore = calculateSafetyScore({
      incidentCount:  record.incidentCount,
      lightingRating: record.lightingRating,
      crowdDensity:   record.crowdDensity,
      lastIncidentAt: record.lastIncidentAt,
    });

    // Persist updated score
    record.score = liveScore;
    await record.save();

    return res.json({
      locationName:   record.locationName,
      score:          liveScore,
      colour:         scoreToColour(liveScore),
      incidentCount:  record.incidentCount,
      lightingRating: record.lightingRating,
      crowdDensity:   record.crowdDensity,
      lastIncidentAt: record.lastIncidentAt,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/safety/heatmap ───────────────────
// Returns array of [lat, lng, intensity] for Leaflet.heat
const getHeatmap = async (req, res, next) => {
  try {
    const records = await SafetyScore.find({}).lean();

    const points = records.map((r) => [
      r.coordinates.lat,
      r.coordinates.lng,
      // Invert score: high incidents = high heat intensity
      parseFloat(((100 - r.score) / 100).toFixed(2)),
    ]);

    return res.json({ points });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/safety/flag ─────────────────────
// Anonymous community flag: increments incidentCount
// Body: { lat, lng, description? }
const flagLocation = async (req, res, next) => {
  try {
    const lat = parseFloat(req.body.lat);
    const lng = parseFloat(req.body.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng are required' });
    }

    let record = await SafetyScore.findOne({
      'coordinates.lat': { $gte: lat - NEARBY_DELTA, $lte: lat + NEARBY_DELTA },
      'coordinates.lng': { $gte: lng - NEARBY_DELTA, $lte: lng + NEARBY_DELTA },
    });

    if (record) {
      record.incidentCount  += 1;
      record.lastIncidentAt  = new Date();
      record.score           = calculateSafetyScore({
        incidentCount:  record.incidentCount,
        lightingRating: record.lightingRating || 3,
        crowdDensity:   record.crowdDensity   || 'medium',
        lastIncidentAt: record.lastIncidentAt,
      });
      await record.save();
    } else {
      // Create a new entry for this location
      const newScore = calculateSafetyScore({
        incidentCount:  1,
        lightingRating: 3,
        crowdDensity:   'medium',
        lastIncidentAt: new Date(),
      });

      record = await SafetyScore.create({
        locationName:   req.body.description || 'Community flagged',
        coordinates:    { lat, lng },
        incidentCount:  1,
        lightingRating: 3,
        crowdDensity:   'medium',
        lastIncidentAt: new Date(),
        score:          newScore,
      });
    }

    return res.status(201).json({
      message:       'Location flagged',
      score:         record.score,
      colour:        scoreToColour(record.score),
      incidentCount: record.incidentCount,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/safety/predict?lat=&lng= ────────
// Predicted risk for next 6 hour slots from now
const predictRisk = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng query params are required' });
    }

    const record = await SafetyScore.findOne({
      'coordinates.lat': { $gte: lat - NEARBY_DELTA, $lte: lat + NEARBY_DELTA },
      'coordinates.lng': { $gte: lng - NEARBY_DELTA, $lte: lng + NEARBY_DELTA },
    });

    // Build predictions for next 6 hour slots
    const now   = new Date();
    const slots = [];

    for (let offset = 0; offset <= 5; offset++) {
      const future = new Date(now.getTime() + offset * 60 * 60 * 1000);
      const score  = calculateSafetyScore({
        incidentCount:  record ? record.incidentCount  : 0,
        lightingRating: record ? record.lightingRating : 3,
        crowdDensity:   record ? record.crowdDensity   : 'medium',
        lastIncidentAt: record ? record.lastIncidentAt : null,
        now:            future,
      });

      slots.push({
        hour:   future.getHours(),
        label:  future.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        score,
        colour: scoreToColour(score),
      });
    }

    return res.json({ predictions: slots });
  } catch (err) {
    next(err);
  }
};

module.exports = { getScore, getHeatmap, flagLocation, predictRisk };