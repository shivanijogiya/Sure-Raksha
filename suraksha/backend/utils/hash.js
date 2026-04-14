// ─────────────────────────────────────────────
//  Suraksha — utils/hash.js
//  Server-side SHA-256 verification
// ─────────────────────────────────────────────
const crypto = require('crypto');

/**
 * Compute SHA-256 of a Buffer and return hex string.
 * @param {Buffer} buffer
 * @returns {string} hex digest
 */
const computeHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Verify that a file buffer matches a client-supplied hex hash.
 * @param {Buffer} buffer     — raw file bytes
 * @param {string} clientHash — hex string sent by browser
 * @returns {boolean}
 */
const verifyHash = (buffer, clientHash) => {
  const serverHash = computeHash(buffer);
  // Use timingSafeEqual to prevent timing attacks
  try {
    const a = Buffer.from(serverHash,          'hex');
    const b = Buffer.from(clientHash.toLowerCase(), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

module.exports = { computeHash, verifyHash };