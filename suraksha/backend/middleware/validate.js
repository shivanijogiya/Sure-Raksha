// ─────────────────────────────────────────────
//  Suraksha — middleware/validate.js
// ─────────────────────────────────────────────
const { body, query, validationResult } = require('express-validator');

// ── Reusable error responder ──────────────────
// Correct signature: (req, res, next) — 3 params, NOT an error handler
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

// ── Complaint validation ──────────────────────
// FIX: category is .optional() — schema has default 'other', so it shouldn't be required
const validateComplaint = [
  body('category')
    .optional()
    .isIn(['harassment', 'stalking', 'assault', 'unsafe_area', 'other'])
    .withMessage('Invalid category'),

  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),

  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 300 }),

  body('coordinates.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),

  body('coordinates.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),

  handleValidation,
];

// ── Safety flag validation ────────────────────
const validateFlag = [
  body('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),

  body('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }),

  handleValidation,
];

// ── Coordinate query validation ───────────────
const validateCoordQuery = [
  query('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),

  query('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),

  handleValidation,
];

module.exports = { validateComplaint, validateFlag, validateCoordQuery };