// Add these two endpoints into your existing backend/routes/safety.js
// alongside your existing routes (score, heatmap, flag, predict)

const { scoreRoute, interpolateWaypoints } = require('../utils/routeScore');
const SafetyScore = require('../models/SafetyScore');

/**
 * GET /api/safety/route?fromLat=&fromLng=&toLat=&toLng=
 * Returns the safety score for the direct path + any danger zones along it.
 */
async function getRouteSafety(req, res) {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;

    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng are all required.' });
    }

    const from = { lat: parseFloat(fromLat), lng: parseFloat(fromLng) };
    const to   = { lat: parseFloat(toLat),   lng: parseFloat(toLng)   };

    const waypoints = interpolateWaypoints(from, to, 15);
    const result    = await scoreRoute(waypoints);

    res.json({
      from,
      to,
      averageScore: result.averageScore,
      safetyLevel:  scoreLabel(result.averageScore),
      dangerZones:  result.dangerZones,
    });

  } catch (err) {
    console.error('[safety/route]', err);
    res.status(500).json({ error: 'Route safety check failed.' });
  }
}

/**
 * GET /api/safety/tags?lat=&lng=
 * Returns risk tags for a specific location.
 */
async function getLocationTags(req, res) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required.' });

    const nearby = await SafetyScore.findOne({
      'coordinates.lat': { $gte: parseFloat(lat) - 0.005, $lte: parseFloat(lat) + 0.005 },
      'coordinates.lng': { $gte: parseFloat(lng) - 0.005, $lte: parseFloat(lng) + 0.005 },
    });

    if (!nearby) return res.json({ tags: [], score: null });

    res.json({ tags: nearby.riskTags || [], score: nearby.score });

  } catch (err) {
    res.status(500).json({ error: 'Tag lookup failed.' });
  }
}

function scoreLabel(score) {
  if (score >= 70) return 'safe';
  if (score >= 40) return 'moderate';
  return 'unsafe';
}

module.exports = { getRouteSafety, getLocationTags };