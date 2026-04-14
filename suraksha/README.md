# 🛡️ Suraksha — Unified Safety Platform

> Anonymous incident reporting + real-time urban safety intelligence.
> Stack: MongoDB · Express.js · Node.js · Plain HTML/CSS/JS (no React)
> Built for GDG WTF'26 — VIT Vellore.

---

## 🗂️ Project Structure

```
suraksha/
│
├── frontend/                        # Pure HTML + CSS + Vanilla JS (no framework)
│   ├── index.html                   # Landing page
│   ├── report.html                  # File a complaint
│   ├── track.html                   # Track complaint status
│   ├── evidence.html                # Evidence locker
│   ├── map.html                     # Real-time safety map
│   │
│   ├── css/
│   │   ├── global.css               # CSS variables, reset, typography
│   │   ├── components.css           # Buttons, cards, forms, badges
│   │   └── animations.css           # Transitions and keyframes
│   │
│   └── js/
│       ├── app.js                   # Shared utils, API base URL, token helper
│       ├── report.js                # Complaint form submit logic
│       ├── track.js                 # Status polling logic
│       ├── evidence.js              # File upload + SHA-256 hash (browser)
│       ├── map.js                   # Leaflet map, safety scores, heatmap
│       └── offline.js               # Service worker registration
│
├── backend/                         # Node.js + Express.js
│   ├── server.js                    # Entry point, middleware, route mounting
│   ├── .env.example                 # Environment variable template
│   │
│   ├── routes/
│   │   ├── complaints.js            # /api/complaints
│   │   ├── evidence.js              # /api/evidence
│   │   └── safety.js                # /api/safety
│   │
│   ├── controllers/
│   │   ├── complaintController.js   # Business logic for complaints
│   │   ├── evidenceController.js    # Hash verify, IPFS upload, DB save
│   │   └── safetyController.js      # Score calc, heatmap, predictions
│   │
│   ├── models/                      # Mongoose schemas
│   │   ├── Complaint.js
│   │   ├── Evidence.js
│   │   └── SafetyScore.js
│   │
│   ├── middleware/
│   │   ├── rateLimit.js             # express-rate-limit
│   │   └── validate.js              # Input validation (express-validator)
│   │
│   └── utils/
│       ├── hash.js                  # SHA-256 server-side verify
│       ├── ipfs.js                  # Pinata IPFS upload helper
│       └── safetyScore.js           # Scoring formula (time + incidents + lighting)
│
├── contracts/                       # Solidity smart contracts
│   ├── EvidenceRegistry.sol         # Timestamps + stores hash on-chain
│   ├── deploy.js                    # Hardhat deploy script
│   └── hardhat.config.js
│
├── sw.js                            # Service worker — offline support
├── manifest.json                    # PWA manifest
└── README.md
```

---

## 🧰 Tech Stack

| Layer | Tool | Why | Cost |
|---|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | No build step, you know it, fast to ship | Free |
| Maps | Leaflet.js + OpenStreetMap | Open source, no API key needed | Free |
| Backend | Node.js + Express.js | You know MERN, straightforward REST API | Free |
| Database | MongoDB Atlas | Flexible schema, you know Mongoose well | Free tier (512 MB) |
| ODM | Mongoose | Schema + validation on top of MongoDB | Free |
| File storage | Multer + GridFS | Store files directly in MongoDB | Free |
| Decentralised storage | Pinata IPFS | Evidence files, tamper-proof, 5 GB free | Free |
| Blockchain | Polygon Mumbai testnet | Hash timestamping, no real gas fees | Free |
| Smart contracts | Solidity + Hardhat | Evidence registry contract | Free |
| Blockchain client | Ethers.js | Connect frontend to contract | Free |
| Offline | Service Worker + IndexedDB | Browser-native, no library needed | Free |

---

## 🗄️ MongoDB Schemas (Mongoose)

### Complaint.js
```js
const ComplaintSchema = new mongoose.Schema({
  anonymousToken:  { type: String, required: true, unique: true },
  category:        { type: String, enum: ['harassment', 'stalking', 'assault', 'unsafe_area', 'other'] },
  description:     { type: String, required: true },
  location:        { type: String },
  coordinates:     { lat: Number, lng: Number },
  status:          { type: String, enum: ['submitted', 'under_review', 'escalated', 'resolved'], default: 'submitted' },
  statusHistory: [{
    status:    String,
    note:      String,
    updatedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });
```

### Evidence.js
```js
const EvidenceSchema = new mongoose.Schema({
  complaintId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  fileName:       String,
  fileType:       String,
  fileSize:       Number,
  sha256Hash:     { type: String, required: true },   // computed in browser, verified server-side
  ipfsCid:        String,                              // Pinata CID after upload
  blockchainTx:   String,                              // Polygon tx hash after on-chain stamp
  uploadedAt:     { type: Date, default: Date.now }
});
```

### SafetyScore.js
```js
const SafetyScoreSchema = new mongoose.Schema({
  locationName:     String,
  coordinates:      { lat: Number, lng: Number },
  score:            { type: Number, min: 0, max: 100 },  // 0 = unsafe, 100 = safe
  incidentCount:    { type: Number, default: 0 },
  lightingRating:   { type: Number, min: 1, max: 5 },
  crowdDensity:     { type: String, enum: ['low', 'medium', 'high'] },
  lastIncidentAt:   Date,
}, { timestamps: true });
```

---

## 📡 API Endpoints

```
# Complaints
POST   /api/complaints                  → File complaint → returns { token, id }
GET    /api/complaints/:token           → Get status + history by anonymous token

# Evidence
POST   /api/evidence/upload             → Upload file → returns { sha256, ipfsCid, txHash }
GET    /api/evidence/:complaintId       → List all evidence for a complaint

# Safety
GET    /api/safety/score?lat=&lng=      → Safety score for coordinates
GET    /api/safety/heatmap              → All incident points array for Leaflet.heat
POST   /api/safety/flag                 → Anonymous community flag a location
GET    /api/safety/predict?lat=&lng=    → Predicted risk for time + location
```

---

## ⚙️ Environment Variables

```env
# backend/.env
PORT=3000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/suraksha
JWT_SECRET=some_random_secret

PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret

POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
DEPLOYER_PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=deployed_contract_address
```

---

## 🚦 Build Order (phase by phase)

### Phase 1 — Frontend UI only (no backend)
- [ ] `global.css` — design system, variables, fonts
- [ ] `index.html` — landing page, links to all sections
- [ ] `report.html` + `report.js` — form, save to localStorage for now
- [ ] `track.html` + `track.js` — read token from localStorage, show mock status

### Phase 2 — Backend + Database
- [ ] MongoDB Atlas cluster setup + `.env`
- [ ] `server.js` — Express app, CORS, body-parser, route mounting
- [ ] `models/Complaint.js` — Mongoose schema
- [ ] `routes/complaints.js` + `controllers/complaintController.js`
- [ ] Connect `report.js` and `track.js` to real API (replace localStorage calls)

### Phase 3 — Evidence Locker
- [ ] `models/Evidence.js`
- [ ] `evidence.html` + `evidence.js` — drag-drop file UI
- [ ] SHA-256 hash computed in browser using Web Crypto API (before upload)
- [ ] `routes/evidence.js` — Multer for file receive, verify hash server-side
- [ ] `utils/ipfs.js` — upload file buffer to Pinata, store CID in MongoDB

### Phase 4 — Safety Map
- [ ] `models/SafetyScore.js` + seed data
- [ ] `map.html` + `map.js` — Leaflet.js map initialisation
- [ ] Colour-coded markers by score (green / amber / red)
- [ ] `utils/safetyScore.js` — formula using time of day + incident count + lighting
- [ ] Leaflet.heat heatmap layer from `/api/safety/heatmap`
- [ ] Community flag button on map → `POST /api/safety/flag`

### Phase 5 — Blockchain (brownie points)
- [ ] `EvidenceRegistry.sol` — `storeHash(bytes32 hash)` function
- [ ] Deploy to Polygon Mumbai with Hardhat
- [ ] `evidence.js` — after IPFS upload, call contract via Ethers.js
- [ ] Store `blockchainTx` in Evidence document

### Phase 6 — Offline + PWA
- [ ] `sw.js` — cache HTML/CSS/JS, queue `POST /api/complaints` in IndexedDB
- [ ] Sync queued reports when back online
- [ ] `manifest.json` — icons, theme colour, installable

---

## ✅ Full Feature Coverage

| Feature | Status |
|---|---|
| Anonymous complaint filing (no login) | Phase 1 → 2 |
| Real-time complaint status tracking | Phase 2 |
| Full status lifecycle (submitted → review → escalated → resolved) | Phase 2 |
| Digital evidence locker (screenshots, audio, call logs) | Phase 3 |
| SHA-256 tamper-proof hashing | Phase 3 |
| Decentralised storage — IPFS via Pinata ⭐ | Phase 3 |
| Blockchain evidence timestamping — Polygon ⭐ | Phase 5 |
| Exportable legal report (PDF from evidence + tx hash) ⭐ | Phase 5 |
| Real-time safety map with scored routes/stops | Phase 4 |
| Time-of-day + crowd + lighting safety scoring | Phase 4 |
| Community anonymous incident flagging ⭐ | Phase 4 |
| Live crowd-sourced heatmap ⭐ | Phase 4 |
| Predictive safety alerts ⭐ | Phase 4 |
| Offline reporting support ⭐ | Phase 6 |
| PWA — installable on phone | Phase 6 |

⭐ = brownie point feature

---

## 🔐 Anonymity Model

- Zero login or registration required
- On complaint submit → `crypto.randomUUID()` generated client-side
- Token stored only in user's browser `localStorage`
- Token is the only key to retrieve complaint status
- No names, emails, IPs, or device fingerprints stored in DB

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/yourname/suraksha.git
cd suraksha

# Backend
cd backend
npm install
cp .env.example .env
# → fill in MONGO_URI and other keys
node server.js

# Frontend (separate terminal)
cd ../frontend
npx serve .
# → open http://localhost:3000
```

---

> MIT License · GDG WTF'26 · VIT Vellore