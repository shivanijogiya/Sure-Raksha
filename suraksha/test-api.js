// ─────────────────────────────────────────────
//  Suraksha — test-api.js
//  Run: node test-api.js
//  Make sure backend is running on port 5000 first
// ─────────────────────────────────────────────

const BASE = 'http://localhost:5000';

let testToken      = null;
let testId         = null;
let testEvidenceId = null;

const pass = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg) => console.log(`  ❌  ${msg}`);
const info = (msg) => console.log(`\n──────────────────────────────\n🔹 ${msg}`);

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ─────────────────────────────────────────────
async function runTests() {
  console.log('\n🛡️  Suraksha API Test Suite');
  console.log('================================\n');

  // ── 1. Health ──────────────────────────────
  info('GET /health');
  try {
    const { status, data } = await req('GET', '/health');
    status === 200 && data.status === 'ok'
      ? pass(`Server is up — ${JSON.stringify(data)}`)
      : fail(`Unexpected response: ${status} ${JSON.stringify(data)}`);
  } catch (e) { fail(`Cannot reach server: ${e.message}`); return; }

  // ── 2. File a complaint ────────────────────
  info('POST /api/complaints');
  testToken = `test-token-${Date.now()}`;
  try {
    const { status, data } = await req('POST', '/api/complaints', {
      anonymousToken: testToken,
      category:       'harassment',
      description:    'This is a test complaint with enough characters.',
      location:       'VIT Vellore Main Gate',
      coordinates:    { lat: 12.9692, lng: 79.1559 },
      riskTags:       ['harassment-prone', 'poor-lighting'],
    });
    status === 201
      ? (testId = data.id, pass(`Complaint filed — token: ${testToken} | id: ${testId}`))
      : fail(`Expected 201, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 3. Duplicate token rejection ──────────
  info('POST /api/complaints (duplicate token — should get 409)');
  try {
    const { status, data } = await req('POST', '/api/complaints', {
      anonymousToken: testToken,
      category:       'other',
      description:    'This should be rejected as duplicate token.',
    });
    status === 409
      ? pass(`Duplicate correctly rejected — ${data.error}`)
      : fail(`Expected 409, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 4. Validation rejection ────────────────
  info('POST /api/complaints (short description — should get 422)');
  try {
    const { status, data } = await req('POST', '/api/complaints', {
      anonymousToken: `token-short-${Date.now()}`,
      description:    'short',
    });
    status === 422
      ? pass(`Validation correctly rejected — ${data.errors?.[0]?.msg}`)
      : fail(`Expected 422, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 5. Get complaint by token ──────────────
  info('GET /api/complaints/:token');
  try {
    const { status, data } = await req('GET', `/api/complaints/${testToken}`);
    status === 200
      ? pass(`Complaint found — status: ${data.status} | riskTags: ${JSON.stringify(data.riskTags)}`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 6. Get complaint — wrong token ─────────
  info('GET /api/complaints/:token (invalid token — should get 404)');
  try {
    const { status } = await req('GET', '/api/complaints/this-token-does-not-exist');
    status === 404
      ? pass('Correctly returned 404 for unknown token')
      : fail(`Expected 404, got ${status}`);
  } catch (e) { fail(e.message); }

  // ── 7. Update complaint status ─────────────
  info('PATCH /api/complaints/:token/status');
  try {
    const { status, data } = await req('PATCH', `/api/complaints/${testToken}/status`, {
      status: 'under_review',
      note:   'Picked up by automated test',
    });
    status === 200
      ? pass(`Status updated to: ${data.status}`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 8. Safety heatmap ──────────────────────
  info('GET /api/safety/heatmap');
  try {
    const { status, data } = await req('GET', '/api/safety/heatmap');
    status === 200
      ? pass(`Heatmap returned ${data.points?.length ?? 0} point(s)`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 9. Safety score ────────────────────────
  info('GET /api/safety/score?lat=12.9692&lng=79.1559');
  try {
    const { status, data } = await req('GET', '/api/safety/score?lat=12.9692&lng=79.1559');
    status === 200
      ? pass(`Score: ${data.score} (${data.colour}) — ${data.label || data.locationName || ''}`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 10. Safety score — missing params ──────
  info('GET /api/safety/score (no params — should get 422)');
  try {
    const { status } = await req('GET', '/api/safety/score');
    status === 422
      ? pass('Correctly rejected missing lat/lng')
      : fail(`Expected 422, got ${status}`);
  } catch (e) { fail(e.message); }

  // ── 11. Flag a location ────────────────────
  info('POST /api/safety/flag');
  try {
    const { status, data } = await req('POST', '/api/safety/flag', {
      lat:         12.9692,
      lng:         79.1559,
      description: 'Test flag from API test suite',
    });
    status === 201
      ? pass(`Location flagged — score: ${data.score}, incidents: ${data.incidentCount}`)
      : fail(`Expected 201, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 12. Safety predict ─────────────────────
  info('GET /api/safety/predict?lat=12.9692&lng=79.1559');
  try {
    const { status, data } = await req('GET', '/api/safety/predict?lat=12.9692&lng=79.1559');
    status === 200
      ? pass(`Predictions returned for ${data.predictions?.length} hour slots`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 13. Safety route ───────────────────────
  
 info('GET /api/safety/route?fromLat=12.9692&fromLng=79.1559&toLat=12.9750&toLng=79.1600');
  try {
    const { status, data } = await req('GET', '/api/safety/route?fromLat=12.9692&fromLng=79.1559&toLat=12.9750&toLng=79.1600');
    status === 200
      ? pass(`Route returned — avg score: ${data.averageScore ?? data.score ?? 'n/a'}, danger zones: ${data.dangerZones?.length ?? 0}`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 14. Safety tags ────────────────────────
  info('GET /api/safety/tags?lat=12.9692&lng=79.1559');
  try {
    const { status, data } = await req('GET', '/api/safety/tags?lat=12.9692&lng=79.1559');
    status === 200
      ? pass(`Tags returned — ${JSON.stringify(data.riskTags ?? data.tags ?? [])}`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 15. Evidence list (no uploads yet) ─────
  info('GET /api/evidence/:complaintId');
  try {
    const { status, data } = await req('GET', `/api/evidence/${testId}`);
    status === 200
      ? pass(`Evidence list returned — ${data.count} record(s)`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 16. Evidence privacy patch ─────────────
  info('PATCH /api/evidence/:id/privacy (skip if no evidence uploaded)');
  if (testEvidenceId) {
    try {
      const { status, data } = await req('PATCH', `/api/evidence/${testEvidenceId}/privacy`, {
        privacyControl: 'share-on-demand',
      });
      status === 200
        ? pass(`Privacy updated — ${data.privacyControl}`)
        : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
    } catch (e) { fail(e.message); }
  } else {
    pass('Skipped — no evidence ID available (no file uploaded in this run)');
  }

  // ── 17. Report generate ────────────────────
  info('POST /api/report/generate');
  try {
    const { status, data } = await req('POST', '/api/report/generate', {
      token: testToken,
    });
    status === 200
      ? pass(`Report generated — fields: ${Object.keys(data).join(', ')}`)
      : fail(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
  } catch (e) { fail(e.message); }

  // ── 18. 404 route ──────────────────────────
  info('GET /api/nonexistent (should get 404)');
  try {
    const { status } = await req('GET', '/api/nonexistent');
    status === 404
      ? pass('Correctly returned 404 for unknown route')
      : fail(`Expected 404, got ${status}`);
  } catch (e) { fail(e.message); }

  console.log('\n================================');
  console.log('✅  Test suite complete\n');
}

runTests().catch(console.error);