// ─────────────────────────────────────────────
//  Suraksha — utils/ipfs.js
//  Pinata IPFS upload helper
// ─────────────────────────────────────────────
const axios = require('axios');
const FormData = require('form-data');

/**
 * Upload a file buffer to Pinata IPFS.
 * Returns the IPFS CID string on success.
 * Throws on failure — caller should catch and handle gracefully.
 *
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @returns {Promise<string>} IPFS CID
 */
const uploadToIPFS = async (fileBuffer, fileName) => {
  // If Pinata keys are not configured, skip silently and return null
  const { PINATA_API_KEY, PINATA_SECRET_KEY } = process.env;

  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    console.warn('[IPFS] Pinata keys not configured — skipping IPFS upload');
    return null;
  }

  const form = new FormData();
  form.append('file', fileBuffer, {
    filename:    fileName || 'evidence',
    contentType: 'application/octet-stream',
  });

  const metadata = JSON.stringify({ name: fileName || 'suraksha-evidence' });
  form.append('pinataMetadata', metadata);

  const options = JSON.stringify({ cidVersion: 1 });
  form.append('pinataOptions', options);

  const response = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    form,
    {
      maxBodyLength: Infinity,
      headers: {
        ...form.getHeaders(),
        pinata_api_key:        PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
    }
  );

  return response.data.IpfsHash; // the CID
};

module.exports = { uploadToIPFS };