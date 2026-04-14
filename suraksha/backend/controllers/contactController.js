// ─────────────────────────────────────────────
//  Suraksha — controllers/contactController.js
// ─────────────────────────────────────────────
const TrustedContact = require('../models/TrustedContact');

// GET /api/contacts?token=
const getContacts = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token is required.' });

    const contacts = await TrustedContact.find({ anonymousToken: token }).lean();
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
};

// POST /api/contacts
// Body: { token, name, phone }
const addContact = async (req, res, next) => {
  try {
    const { token, name, phone } = req.body;

    if (!token) return res.status(400).json({ error: 'Token is required.' });
    if (!name)  return res.status(400).json({ error: 'Name is required.' });
    if (!phone) return res.status(400).json({ error: 'Phone is required.' });

    const contact = await TrustedContact.create({
      anonymousToken: token,
      name,
      phone,
      alertEnabled: true,
    });

    res.status(201).json({ contact });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/contacts/:id
// Body: { alertEnabled }
const updateContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { alertEnabled } = req.body;

    const contact = await TrustedContact.findByIdAndUpdate(
      id,
      { alertEnabled },
      { new: true }
    );

    if (!contact) return res.status(404).json({ error: 'Contact not found.' });

    res.json({ contact });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/contacts/:id
const deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;

    const contact = await TrustedContact.findByIdAndDelete(id);
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });

    res.json({ message: 'Contact deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getContacts, addContact, updateContact, deleteContact };