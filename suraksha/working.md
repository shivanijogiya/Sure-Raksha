# 🛡️ Suraksha — How The System Works

> Built for GDG WTF'26 · VIT Vellore
> Stack: MongoDB · Express.js · Node.js · HTML/CSS/JS · Solidity · Hardhat

---

## 🖥️ What Is Running & Where

| Service | What It Does | URL |
|---|---|---|
| **Backend** | REST API — handles complaints, evidence, safety scores | http://localhost:5000 |
| **Frontend** | The actual website users see | http://localhost:3000 |
| **Local Blockchain** | Fake Ethereum node for testing smart contracts | http://127.0.0.1:8545 |
| **MongoDB** | Database storing all complaints, evidence, scores | localhost:27017 |

---

## 🚀 How To Start Everything (Every Time)

Open **4 terminals** and run one command in each:

### Terminal 1 — Database
```bash
net start MongoDB
```

### Terminal 2 — Backend
```bash
cd suraksha/backend
npm start
```
✅ You should see: `[DB] MongoDB connected` and `[SERVER] Running on http://localhost:5000`

### Terminal 3 — Blockchain Node
```bash
cd suraksha/contracts
npx hardhat node
```
✅ You should see: `Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/`

### Terminal 4 — Frontend
```bash
cd suraksha/frontend
npx serve .
```
✅ You should see: `Serving at http://localhost:3000`

Then open **http://localhost:3000** in your browser.

---

## 🔄 How The Full System Works — Step By Step

### Step 1 — User Files a Complaint (Anonymous)
```
Browser                    Backend                   MongoDB
  |                           |                          |
  |-- Random UUID generated   |                          |
  |   in browser (no login)   |                          |
  |                           |                          |
  |-- POST /api/complaints --> |                          |
  |   { token, category,      |-- Save complaint ------> |
  |     description, location }|                         |
  |                           |<-- Complaint saved ------ |
  |<-- { token, id, status } --|                          |
  |                           |                          |
  |-- Token saved to          |                          |
     localStorage             |                          |
```

### Step 2 — User Tracks Their Complaint
```
Browser                    Backend                   MongoDB
  |                           |                          |
  |-- Read token from         |                          |
  |   localStorage            |                          |
  |                           |                          |
  |-- GET /api/complaints/:token -->                     |
  |                           |-- Find by token -------> |
  |                           |<-- Complaint data ------- |
  |<-- { status, history } ---|                          |
```

### Step 3 — User Uploads Evidence
```
Browser          Backend           MongoDB          IPFS (Pinata)
  |                  |                 |                  |
  |-- SHA-256 hash   |                 |                  |
  |   computed in    |                 |                  |
  |   browser        |                 |                  |
  |                  |                 |                  |
  |-- POST /api/evidence/upload -->    |                  |
  |   { file, complaintId, hash }      |                  |
  |                  |                 |                  |
  |                  |-- Verify hash   |                  |
  |                  |-- Upload file ----------------->   |
  |                  |<-- IPFS CID -------------------- - |
  |                  |-- Save record -> |                  |
  |<-- { sha256, ipfsCid, txHash } ----|                  |
```

### Step 4 — Blockchain Timestamping (Phase 5)
```
Browser          Smart Contract (Polygon)       Backend
  |                      |                         |
  |-- Convert hash to    |                         |
  |   bytes32            |                         |
  |                      |                         |
  |-- storeHash(hash) -> |                         |
  |                      |-- Timestamp on-chain    |
  |<-- txHash -----------|                         |
  |                      |                         |
  |-- PATCH /api/evidence/:id/blockchain -->       |
  |   { txHash }                                   |
  |                      |           Save txHash ->|
```

### Step 5 — Safety Map
```
Browser                    Backend                   MongoDB
  |                           |                          |
  |-- GET /api/safety/heatmap ->                         |
  |                           |-- Fetch all scores ----> |
  |                           |<-- Score array ---------- |
  |<-- [[lat,lng,intensity]]--|                          |
  |                           |                          |
  |-- Render Leaflet.heat     |                          |
  |   heatmap on map          |                          |
  |                           |                          |
  |-- User flags location     |                          |
  |-- POST /api/safety/flag ->|                          |
  |                           |-- Increment incident --> |
  |                           |-- Recalculate score      |
  |<-- { score, colour } -----|                          |
```

---

## 🗂️ Full File Structure Explained

```
suraksha/
│
├── frontend/                  ← What users see in browser
│   ├── index.html             ← Landing page
│   ├── report.html            ← File a complaint form
│   ├── track.html             ← Check complaint status
│   ├── evidence.html          ← Upload evidence files
│   ├── map.html               ← Real-time safety heatmap
│   ├── css/                   ← All styling
│   └── js/                    ← All frontend logic
│
├── backend/                   ← Node.js server (port 5000)
│   ├── server.js              ← Entry point — starts everything
│   ├── .env                   ← Your secret keys (never commit!)
│   ├── models/                ← MongoDB data shapes
│   │   ├── Complaint.js       ← Complaint schema
│   │   ├── Evidence.js        ← Evidence schema
│   │   └── SafetyScore.js     ← Safety score schema
│   ├── routes/                ← URL paths
│   │   ├── complaints.js      ← /api/complaints
│   │   ├── evidence.js        ← /api/evidence
│   │   └── safety.js          ← /api/safety
│   ├── controllers/           ← Business logic
│   ├── middleware/            ← Rate limiting, validation
│   └── utils/                 ← Hash, IPFS, score helpers
│
├── contracts/                 ← Blockchain (Solidity)
│   ├── contracts/
│   │   └── EvidenceRegistry.sol  ← Smart contract
│   ├── deploy.js              ← Deploy script
│   └── hardhat.config.js      ← Blockchain config
│
├── sw.js                      ← Offline support (PWA)
└── manifest.json              ← Makes app installable on phone
```

---

## 📡 All API Endpoints

| Method | URL | What It Does |
|---|---|---|
| `GET` | `/health` | Check if server is alive |
| `POST` | `/api/complaints` | File a new complaint |
| `GET` | `/api/complaints/:token` | Get complaint status by token |
| `PATCH` | `/api/complaints/:token/status` | Update complaint status |
| `POST` | `/api/evidence/upload` | Upload evidence file |
| `GET` | `/api/evidence/:complaintId` | List evidence for a complaint |
| `PATCH` | `/api/evidence/:id/blockchain` | Store blockchain tx hash |
| `GET` | `/api/safety/score?lat=&lng=` | Get safety score for location |
| `GET` | `/api/safety/heatmap` | All incident points for map |
| `POST` | `/api/safety/flag` | Anonymously flag a location |
| `GET` | `/api/safety/predict?lat=&lng=` | Predicted risk for next 6 hours |

---

## 🔐 Anonymity — How It Works

```
1. User opens report.html
2. Browser runs: crypto.randomUUID()  →  generates e.g. "a3f9-bc12-..."
3. UUID stored in localStorage (never sent to any server as identity)
4. UUID used as anonymousToken in complaint
5. Only the user with that token in their browser can track the complaint
6. No name, email, IP, or device info ever stored in database
```

---

## 🧮 Safety Score Formula

Score starts at **100** and gets reduced by:

| Factor | Penalty |
|---|---|
| Each incident at location | −5 points (max −50) |
| Poor lighting (rating 1/5) | −10 points |
| Night hours (9pm–5am) | −15 points |
| Late evening (6pm–9pm) | −8 points |
| Low crowd at night | extra −10 points |
| Incident within last 24hrs | −20 points |
| Incident within last 7 days | −10 points |

| Score | Colour | Meaning |
|---|---|---|
| 70–100 | 🟢 Green | Safe |
| 40–69 | 🟡 Amber | Caution |
| 0–39 | 🔴 Red | Unsafe |

---

## 🔧 Useful Commands

```bash
# Test backend is running
curl http://localhost:5000/health

# File a test complaint
curl -X POST http://localhost:5000/api/complaints \
  -H "Content-Type: application/json" \
  -d '{"anonymousToken":"test-123","category":"other","description":"Test complaint for demo"}'

# Get safety heatmap data
curl http://localhost:5000/api/safety/heatmap

# Recompile smart contract
cd contracts && npx hardhat compile

# Redeploy contract locally
cd contracts && npx hardhat run deploy.js --network hardhat
```

---

## ⚠️ Common Issues & Fixes

| Problem | Fix |
|---|---|
| `MongoDB connected` not showing | Run `net start MongoDB` as Administrator |
| `EADDRINUSE port 5000` | Change `PORT=5001` in `backend/.env` |
| Frontend shows blank page | Make sure HTML files exist in `frontend/` folder |
| Contract deploy fails | Make sure `npx hardhat node` is running first in another terminal |
| `Cannot find module` error | Run `npm install` inside that folder |

---

> 🛡️ Suraksha — Protecting communities through anonymous, tamper-proof safety reporting.
> MIT License · GDG WTF'26 · VIT Vellore