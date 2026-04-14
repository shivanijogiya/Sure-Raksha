// ─────────────────────────────────────────────
//  Suraksha — controllers/complaintController.js
// ─────────────────────────────────────────────
const SafetyScore = require('../models/SafetyScore');
const { calculateSafetyScore } = require('../utils/safetyScore');
const NEARBY_DELTA = 0.01;
const Complaint = require('../models/Complaint');

// ── POST /api/complaints ──────────────────────
// Body: { anonymousToken, category, description, location?, coordinates? }
const fileComplaint = async (req, res, next) => {
  try {
    const { anonymousToken, category, description, location, coordinates } = req.body;

    if (!anonymousToken) {
      return res.status(400).json({ error: 'anonymousToken is required' });
    }

    // Prevent duplicate tokens (user retrying the same submission)
    const existing = await Complaint.findOne({ anonymousToken });
    if (existing) {
      return res.status(409).json({ error: 'Token already used. Use your existing token to track.' });
    }

    const complaint = new Complaint({
      anonymousToken,
      category:    category    || 'other',
      description,
      location:    location    || '',
      coordinates: coordinates || {},
      // Seed first status history entry
      statusHistory: [{ status: 'submitted', note: 'Complaint received.' }],
    });

    await complaint.save();

    // ── SafetyScore update ────────────────────────────────────────────
    if (coordinates?.lat && coordinates?.lng) {
      let area = await SafetyScore.findOne({
        'coordinates.lat': { $gte: coordinates.lat - NEARBY_DELTA, $lte: coordinates.lat + NEARBY_DELTA },
        'coordinates.lng': { $gte: coordinates.lng - NEARBY_DELTA, $lte: coordinates.lng + NEARBY_DELTA },
      });

      if (!area) {
        area = await SafetyScore.create({
          locationName:   location || 'Reported area',
          coordinates:    { lat: coordinates.lat, lng: coordinates.lng },
          incidentCount:  0,
          lightingRating: 3,
          crowdDensity:   'medium',
          lastIncidentAt: null,
          score:          100,
        });
      }

      if (area) {
        area.incidentCount += 1;
        area.lastIncidentAt = new Date();
        const categoryPenalty = { assault: 20, stalking: 15, harassment: 10, unsafe_area: 8, other: 5 };
        const penalty = categoryPenalty[category] || 5;
        area.score = Math.max(0, Math.min(
          area.score - penalty,
          calculateSafetyScore({
            incidentCount:  area.incidentCount,
            lightingRating: area.lightingRating,
            crowdDensity:   area.crowdDensity,
            lastIncidentAt: area.lastIncidentAt,
          })
        ));
        await area.save();
      }
    }
    // ── end SafetyScore update ────────────────────────────────────────

    return res.status(201).json({
      message: 'Complaint filed successfully',
      token:   complaint.anonymousToken,
      id:      complaint._id,
      status:  complaint.status,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/complaints/:token ────────────────
// Returns complaint + full status history
const getComplaintByToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const complaint = await Complaint.findOne({ anonymousToken: token }).select('-__v');

    if (!complaint) {
      return res.status(404).json({ error: 'No complaint found for this token' });
    }

    return res.json({
      id:            complaint._id,
      category:      complaint.category,
      description:   complaint.description,
      location:      complaint.location,
      coordinates:   complaint.coordinates,
      status:        complaint.status,
      statusHistory: complaint.statusHistory,
      createdAt:     complaint.createdAt,
      updatedAt:     complaint.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/complaints/:token/status ───────
// Internal / admin use: advance complaint status
// Body: { status, note }
const updateStatus = async (req, res, next) => {
  try {
    const { token }        = req.params;
    const { status, note } = req.body;

    const allowed = ['submitted', 'under_review', 'escalated', 'resolved'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const complaint = await Complaint.findOne({ anonymousToken: token });
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    complaint.status = status;
    complaint.statusHistory.push({ status, note: note || '' });
    await complaint.save();

    return res.json({ message: 'Status updated', status: complaint.status });
  } catch (err) {
    next(err);
  }
};

module.exports = { fileComplaint, getComplaintByToken, updateStatus };