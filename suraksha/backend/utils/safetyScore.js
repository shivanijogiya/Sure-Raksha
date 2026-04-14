// ─────────────────────────────────────────────
//  Suraksha — utils/safetyScore.js
//  Scoring formula: time of day + incidents + lighting
// ─────────────────────────────────────────────

/**
 * Calculate a safety score (0–100) for a location.
 * Score starts at 100 and deductions are applied.
 *
 * @param {object} params
 * @param {number}  params.incidentCount   — total flagged incidents at location
 * @param {number}  params.lightingRating  — 1 (dark) to 5 (well lit)
 * @param {string}  params.crowdDensity    — 'low' | 'medium' | 'high'
 * @param {Date}    params.lastIncidentAt  — date of most recent incident (or null)
 * @param {Date}   [params.now]            — override "now" for predictions (default: new Date())
 * @returns {number} score clamped to [0, 100]
 */
const calculateSafetyScore = ({
  incidentCount  = 0,
  lightingRating = 3,
  crowdDensity   = 'medium',
  lastIncidentAt = null,
  now            = new Date(),
}) => {
  let score = 100;

  // ── Incident count penalty (max −50) ─────────
  const incidentPenalty = Math.min(incidentCount * 5, 50);
  score -= incidentPenalty;

  // ── Lighting penalty ──────────────────────────
  // lightingRating 1 = very dark → −10, 5 = bright → 0
  if (lightingRating <= 1) score -= 10;
  else if (lightingRating === 2) score -= 6;
  else if (lightingRating === 3) score -= 3;
  // 4 and 5 → no penalty

  // ── Time-of-day penalty ───────────────────────
  const hour = now.getHours(); // 0–23
  const isNight     = hour >= 21 || hour < 5;  // 9 pm – 5 am
  const isEvening   = hour >= 18 && hour < 21; // 6 pm – 9 pm

  if (isNight)   score -= 15;
  else if (isEvening) score -= 8;

  // ── Low crowd at night extra penalty ─────────
  if (isNight && crowdDensity === 'low') score -= 10;

  // ── Recent incident penalty ───────────────────
  if (lastIncidentAt) {
    const msAgo = now.getTime() - new Date(lastIncidentAt).getTime();
    const hoursAgo = msAgo / (1000 * 60 * 60);

    if (hoursAgo <= 24)         score -= 20; // within last 24 hrs
    else if (hoursAgo <= 168)   score -= 10; // within last 7 days
  }

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Map a numeric score to a colour label.
 * @param {number} score
 * @returns {'green' | 'amber' | 'red'}
 */
const scoreToColour = (score) => {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
};

module.exports = { calculateSafetyScore, scoreToColour };