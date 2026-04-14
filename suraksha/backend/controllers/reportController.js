const Complaint = require('../models/Complaint');
const Evidence  = require('../models/Evidence');
const { buildLegalReport } = require('../utils/pdfReport');

/**
 * POST /api/report/generate
 * Body: { token, laws: ['...', '...'] }
 * Streams a PDF back to the client.
 */
async function generateReport(req, res) {
  try {
    const { token, laws = [] } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Anonymous token is required.' });
    }

    const complaint = await Complaint.findOne({ anonymousToken: token });
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found for this token.' });
    }

    const evidence = await Evidence.find({ complaintId: complaint._id });

    const doc = buildLegalReport({ complaint, evidence, laws });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="suraksha-report-${token.slice(0, 8)}.pdf"`);

    doc.pipe(res);
    doc.end();

  } catch (err) {
    console.error('[reportController] Error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
}

module.exports = { generateReport };