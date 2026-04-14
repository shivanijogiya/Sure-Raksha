// ─────────────────────────────────────────────
//  Suraksha — utils/routeScore.js
//  Scores a path between two coordinates using
//  nearby SafetyScore documents from MongoDB
// ─────────────────────────────────────────────
const SafetyScore = require('../models/SafetyScore');

/**
 * Generates intermediate lat/lng waypoints between two points.
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @param {number} steps — number of intermediate points
 * @returns {{ lat: number, lng: number }[]}
 */
function interpolateWaypoints(from, to, steps = 15) {
  const waypoints = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    waypoints.push({
      lat: from.lat + t * (to.lat - from.lat),
      lng: from.lng + t * (to.lng - from.lng),
    });
  }
  return waypoints;
}

/**
 * Scores an array of waypoints against SafetyScore documents.
 * @param {{ lat: number, lng: number }[]} waypoints
 * @returns {{ averageScore: number, dangerZones: object[] }}
 */
async function scoreRoute(waypoints) {
  const results = await Promise.all(
    waypoints.map(async ({ lat, lng }) => {
      const nearby = await SafetyScore.findOne({
        'coordinates.lat': { $gte: lat - 0.005, $lte: lat + 0.005 },
        'coordinates.lng': { $gte: lng - 0.005, $lte: lng + 0.005 },
      }).sort({ score: 1 }); // worst score nearest = most relevant

      return {
        lat,
        lng,
        score:        nearby?.score        ?? 100,
        riskTags:     nearby?.riskTags     ?? [],
        locationName: nearby?.locationName ?? '',
      };
    })
  );

  const total        = results.reduce((sum, p) => sum + p.score, 0);
  const averageScore = Math.round(total / results.length);

  // Danger zones = waypoints scoring below 40
  const dangerZones = results
    .filter((p) => p.score < 40)
    .map((p) => ({
      lat:          p.lat,
      lng:          p.lng,
      score:        p.score,
      riskTags:     p.riskTags,
      locationName: p.locationName,
    }));

  return { averageScore, dangerZones };
}

module.exports = { interpolateWaypoints, scoreRoute };