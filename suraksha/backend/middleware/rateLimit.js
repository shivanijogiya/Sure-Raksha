// ─────────────────────────────────────────────
//  Suraksha — middleware/rateLimit.js
// ─────────────────────────────────────────────
const rateLimit = require('express-rate-limit');

// Exports the limiter instance directly so server.js can do:
//   const apiLimiter = require('./middleware/rateLimit');
//   app.use('/api/', apiLimiter);
module.exports = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             100,             // max 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});