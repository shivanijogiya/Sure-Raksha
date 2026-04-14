// ─────────────────────────────────────────────
//  Suraksha — routes/contacts.js
// ─────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getContacts,
  addContact,
  updateContact,
  deleteContact,
} = require('../controllers/contactController');

// GET  /api/contacts?token=
router.get('/',     getContacts);

// POST /api/contacts
router.post('/',    addContact);

// PATCH /api/contacts/:id
router.patch('/:id', updateContact);

// DELETE /api/contacts/:id
router.delete('/:id', deleteContact);

module.exports = router;