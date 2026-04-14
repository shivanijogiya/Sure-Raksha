// ─────────────────────────────────────────────
//  Suraksha — controllers/evidenceController.js
// ─────────────────────────────────────────────
const Evidence  = require('../models/Evidence');
const Complaint = require('../models/Complaint');
const { verifyHash }   = require('../utils/hash');
const { uploadToIPFS } = require('../utils/ipfs');

// ── POST /api/evidence/upload ─────────────────
// Multipart form: file + complaintId + clientHash
const uploadEvidence = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { complaintId, clientHash } = req.body;

    if (!complaintId || !clientHash) {
      return res.status(400).json({ error: 'complaintId and clientHash are required' });
    }

    // Verify complaint exists
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Verify SHA-256 integrity: client hash must match server-computed hash
    const isValid = verifyHash(req.file.buffer, clientHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Hash mismatch — file may be corrupted or tampered' });
    }

    // Upload to IPFS via Pinata (non-fatal if it fails)
    let ipfsCid = null;
    try {
      ipfsCid = await uploadToIPFS(req.file.buffer, req.file.originalname);
    } catch (ipfsErr) {
      console.error('[IPFS] Upload failed:', ipfsErr.message);
    }

    // Persist evidence record
    const evidence = new Evidence({
      complaintId:  complaint._id,
      fileName:     req.file.originalname,
      fileType:     req.file.mimetype,
      fileSize:     req.file.size,
      sha256Hash:   clientHash.toLowerCase(),
      ipfsCid,
      blockchainTx: null,   // filled later in Phase 5
    });

    await evidence.save();

    return res.status(201).json({
      message:    'Evidence uploaded',
      evidenceId: evidence._id,
      sha256:     evidence.sha256Hash,
      ipfsCid:    evidence.ipfsCid,
      txHash:     evidence.blockchainTx,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/evidence/:complaintId ───────────
// List all evidence records for a complaint
const getEvidenceByComplaint = async (req, res, next) => {
  try {
    const { complaintId } = req.params;

    const records = await Evidence.find({ complaintId }).select('-__v').lean();

    return res.json({ count: records.length, evidence: records });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/evidence/:id/blockchain ───────
// Phase 5: store blockchain tx hash after on-chain stamp
const updateBlockchainTx = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { txHash } = req.body;

    if (!txHash) {
      return res.status(400).json({ error: 'txHash is required' });
    }

    const evidence = await Evidence.findByIdAndUpdate(
      id,
      { blockchainTx: txHash },
      { new: true }
    );

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence record not found' });
    }

    return res.json({ message: 'Blockchain tx stored', blockchainTx: evidence.blockchainTx });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadEvidence, getEvidenceByComplaint, updateBlockchainTx };