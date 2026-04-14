// ─────────────────────────────────────────────
//  Suraksha — server.js  (Entry point)
// ─────────────────────────────────────────────
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');
const path     = require('path');

dotenv.config();

const app = express();

// ── Middleware ────────────────────────────────
app.use(cors({
  origin:  '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (fallback; GridFS is primary)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rate limiter ──────────────────────────────
const apiLimiter = require('./middleware/rateLimit');
app.use('/api/', apiLimiter);

// ── Routes ────────────────────────────────────
const complaintRoutes = require('./routes/complaints');
const evidenceRoutes  = require('./routes/evidence');
const safetyRoutes    = require('./routes/safety');
const reportRoutes    = require('./routes/report');
const contactRoutes   = require('./routes/contacts');

app.use('/api/complaints', complaintRoutes);
app.use('/api/evidence',   evidenceRoutes);
app.use('/api/safety',     safetyRoutes);
app.use('/api/report',     reportRoutes);
app.use('/api/contacts',   contactRoutes);

// ── Health check ──────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── 404 catch-all ─────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── MongoDB + Start ───────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('[DB] MongoDB connected');
    app.listen(PORT, () => console.log(`[SERVER] Running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  });