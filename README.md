#  Suraksha — Unified Safety & Trust Platform

 Anonymous incident reporting + real-time urban safety intelligence + women-centric legal tools.
Stack: MongoDB · Express.js · Node.js · Plain HTML/CSS/JS (no React)
Built for GDG WTF'26 — VIT Vellore.

---

## Project Structure

```
suraksha/
│
├── frontend/
│   ├── index.html                   # Landing page
│   ├── report.html                  # File a complaint
│   ├── track.html                   # Track complaint status
│   ├── evidence.html                # Evidence locker
│   ├── map.html                     # Real-time safety map  ← EDITED (add safe route button)
│   ├── legal.html                   # ★ NEW — Legal awareness + rights guide
│   ├── route.html                   # ★ NEW — Safe route recommendation
│   ├── contacts.html                # ★ NEW — Trusted contacts + live location share
│   │
│   ├── css/
│   │   ├── global.css               # CSS variables, reset, typography
│   │   ├── components.css           # Buttons, cards, forms, badges
│   │   └── animations.css           # Transitions and keyframes
│   │
│   └── js/
│       ├── app.js                   # Shared utils, API base URL, token helper
│       ├── report.js                # ← EDITED (add gender-specific risk tag selector)
│       ├── track.js                 # Status polling logic
│       ├── evidence.js              # File upload + SHA-256 hash (browser)
│       ├── map.js                   # ← EDITED (add safe route trigger + risk tag layer)
│       ├── offline.js               # Service worker registration
│       ├── legal.js                 # ★ NEW — Legal guidance lookup logic
│       ├── route.js                 # ★ NEW — Safe route calc using safety scores
│       ├── contacts.js              # ★ NEW — Trusted contacts CRUD + location share
│       └── report-gen.js            # ★ NEW — Auto-generate structured legal PDF report
│
├── backend/
│   ├── server.js                    # Entry point, middleware, route mounting
│   ├── .env.example
│   │
│   ├── routes/
│   │   ├── complaints.js            # /api/complaints
│   │   ├── evidence.js              # /api/evidence
│   │   ├── safety.js                # /api/safety
│   │   └── report.js                # ★ NEW — /api/report (PDF generation)
│   │
│   ├── controllers/
│   │   ├── complaintController.js   # ← EDITED (handle riskTags field)
│   │   ├── evidenceController.js    # ← EDITED (handle privacy flag)
│   │   ├── safetyController.js      # ← EDITED (add risk tag filter + route scoring)
│   │   └── reportController.js      # ★ NEW — Build + stream PDF legal report
│   │
│   ├── models/
│   │   ├── Complaint.js             # ← EDITED (add riskTags + privacyLevel fields)
│   │   ├── Evidence.js              # ← EDITED (add privacyControl field)
│   │   ├── SafetyScore.js           # ← EDITED (add riskTags array field)
│   │   └── TrustedContact.js        # ★ NEW — Emergency contacts schema
│   │
│   ├── middleware/
│   │   ├── rateLimit.js
│   │   └── validate.js
│   │
│   └── utils/
│       ├── hash.js
│       ├── ipfs.js
│       ├── safetyScore.js           # ← EDITED (add risk tag scoring penalty)
│       ├── routeScore.js            # ★ NEW — Score a path between two coordinates
│       └── pdfReport.js             # ★ NEW — PDFKit report builder
│
├── contracts/
│   ├── EvidenceRegistry.sol
│   ├── deploy.js
│   └── hardhat.config.js
│
├── sw.js
├── manifest.json
└── README.md
```

---

## 🧰 Tech Stack

| Layer | Tool | Why | Cost |
|---|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | No build step, fast to ship | Free |
| Maps | Leaflet.js + OpenStreetMap | Open source, no API key needed | Free |
| Backend | Node.js + Express.js | MERN stack, REST API | Free |
| Database | MongoDB Atlas | Flexible schema, Mongoose | Free tier |
| File storage | Multer + GridFS | Files in MongoDB | Free |
| Decentralised storage | Pinata IPFS | Tamper-proof evidence | Free (5 GB) |
| Blockchain | Polygon Mumbai testnet | Hash timestamping | Free |
| Smart contracts | Solidity + Hardhat | Evidence registry | Free |
| Blockchain client | Ethers.js | Frontend → contract | Free |
| PDF generation | PDFKit | Legal report export | Free |
| Offline | Service Worker + IndexedDB | Browser-native | Free |

---

## 🗄️ MongoDB Schemas (Mongoose)

### Complaint.js ← EDITED
```js
const ComplaintSchema = new mongoose.Schema({
  anonymousToken:  { type: String, required: true, unique: true },
  category:        { type: String, enum: ['harassment', 'stalking', 'assault', 'unsafe_area', 'other'] },
  description:     { type: String, required: true },
  location:        { type: String },
  coordinates:     { lat: Number, lng: Number },
  riskTags:        [{ type: String, enum: ['harassment-prone', 'stalking-prone', 'poor-lighting', 'isolated', 'other'] }], // ★ NEW
  status:          { type: String, enum: ['submitted', 'under_review', 'escalated', 'resolved'], default: 'submitted' },
  statusHistory: [{
    status:    String,
    note:      String,
    updatedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });
```

### Evidence.js ← EDITED
```js
const EvidenceSchema = new mongoose.Schema({
  complaintId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  fileName:       String,
  fileType:       String,
  fileSize:       Number,
  sha256Hash:     { type: String, required: true },
  ipfsCid:        String,
  blockchainTx:   String,
  privacyControl: { type: String, enum: ['private', 'share-on-demand', 'public'], default: 'private' }, // ★ NEW
  uploadedAt:     { type: Date, default: Date.now }
});
```

### SafetyScore.js ← EDITED
```js
const SafetyScoreSchema = new mongoose.Schema({
  locationName:   String,
  coordinates:    { lat: Number, lng: Number },
  score:          { type: Number, min: 0, max: 100 },
  incidentCount:  { type: Number, default: 0 },
  lightingRating: { type: Number, min: 1, max: 5 },
  crowdDensity:   { type: String, enum: ['low', 'medium', 'high'] },
  lastIncidentAt: Date,
  riskTags:       [{ type: String, enum: ['harassment-prone', 'stalking-prone', 'poor-lighting', 'isolated'] }], // ★ NEW
}, { timestamps: true });
```

### TrustedContact.js ★ NEW
```js
const TrustedContactSchema = new mongoose.Schema({
  anonymousToken: { type: String, required: true },   // links to complaint owner, no real identity
  name:           { type: String, required: true },
  phone:          { type: String, required: true },
  alertEnabled:   { type: Boolean, default: true },
}, { timestamps: true });
```

---

## 📡 API Endpoints

```
# Complaints
POST   /api/complaints                        → File complaint → { token, id }
GET    /api/complaints/:token                 → Status + history

# Evidence
POST   /api/evidence/upload                   → Upload file → { sha256, ipfsCid, txHash }
GET    /api/evidence/:complaintId             → List evidence
PATCH  /api/evidence/:id/privacy             # ★ NEW → Update privacy control

# Safety
GET    /api/safety/score?lat=&lng=            → Score for coordinates
GET    /api/safety/heatmap                    → Incident points for Leaflet.heat
POST   /api/safety/flag                       → Flag a location
GET    /api/safety/predict?lat=&lng=          → Predicted risk
GET    /api/safety/route?from=&to=           # ★ NEW → Safe route between two points
GET    /api/safety/tags?lat=&lng=            # ★ NEW → Risk tags for a location

# Report (Legal PDF)                         # ★ NEW route file
POST   /api/report/generate                  # ★ NEW → Generate + return PDF
```

---

## ⚙️ Environment Variables

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/suraksha
JWT_SECRET=some_random_secret

PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret

POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
DEPLOYER_PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=deployed_contract_address
```

---

## 🚦 Build Order

### Phase 1 — Frontend UI only
- [ ] `global.css` — design system
- [ ] `index.html` — landing page
- [ ] `report.html` + `report.js` — form with risk tag selector
- [ ] `track.html` + `track.js` — mock status

### Phase 2 — Backend + Database
- [ ] MongoDB Atlas + `.env`
- [ ] `server.js` — Express, CORS, routes
- [ ] `models/Complaint.js` — with riskTags
- [ ] `routes/complaints.js` + `controllers/complaintController.js`

### Phase 3 — Evidence Locker
- [ ] `models/Evidence.js` — with privacyControl
- [ ] `evidence.html` + `evidence.js` — drag-drop + privacy toggle
- [ ] SHA-256 browser hash → Pinata IPFS

### Phase 4 — Safety Map
- [ ] `models/SafetyScore.js` — with riskTags
- [ ] `map.html` + `map.js` — Leaflet + heatmap + risk tag layer
- [ ] `utils/safetyScore.js` — scoring with tag penalties
- [ ] Community flag button

### Phase 5 — New Women-Centric Features ★
- [ ] `legal.html` + `legal.js` — legal rights + applicable laws
- [ ] `route.html` + `route.js` — safe route (avoids low-score zones)
- [ ] `utils/routeScore.js` — path scoring logic
- [ ] `contacts.html` + `contacts.js` — trusted contacts + location share
- [ ] `models/TrustedContact.js`

### Phase 6 — Legal Report + PDF ★
- [ ] `utils/pdfReport.js` — PDFKit builder
- [ ] `controllers/reportController.js` + `routes/report.js`
- [ ] `frontend/js/report-gen.js` — trigger PDF download from browser

### Phase 7 — Blockchain
- [ ] `EvidenceRegistry.sol` deploy to Polygon Mumbai
- [ ] Wire txHash into evidence flow

### Phase 8 — Offline + PWA
- [ ] `sw.js` — cache + IndexedDB queue
- [ ] `manifest.json`

---

## ✅ Full Feature Coverage

| Feature | Phase |
|---|---|
| Anonymous complaint filing | 1 → 2 |
| Real-time complaint status tracking | 2 |
| Full status lifecycle | 2 |
| Gender-specific risk tagging (harassment-prone, stalking-prone) | 2 + 4 |
| Digital evidence locker | 3 |
| Evidence privacy control (private / share-on-demand) | 3 |
| SHA-256 tamper-proof hashing | 3 |
| IPFS via Pinata ⭐ | 3 |
| Real-time safety map + heatmap | 4 |
| Risk tag layer on map | 4 |
| Community anonymous flagging ⭐ | 4 |
| Predictive safety alerts ⭐ | 4 |
| Legal awareness + rights guide ★ | 5 |
| Safe route recommendation (avoids unsafe zones) ★ | 5 |
| Trusted contact system + live location alert ★ | 5 |
| Smart legal report generator (PDF) ★ | 6 |
| Authority export (police / NGO PDF) ★ | 6 |
| Blockchain evidence timestamping ⭐ | 7 |
| Offline reporting support ⭐ | 8 |
| PWA installable | 8 |

⭐ = original brownie point feature
★ = newly added women-centric feature

---

## 🔐 Anonymity Model

- Zero login required
- `crypto.randomUUID()` generated client-side on submit
- Token stored only in user's `localStorage`
- No names, emails, IPs, or device fingerprints in DB
- Trusted contacts linked only via anonymous token — no identity leak

---

## 🚀 Quick Start

```bash
git clone https://github.com/yourname/suraksha.git
cd suraksha

cd backend
npm install
cp .env.example .env
node server.js

cd ../frontend
npx serve .
```

---

> MIT License · GDG WTF'26 · VIT Vellore
