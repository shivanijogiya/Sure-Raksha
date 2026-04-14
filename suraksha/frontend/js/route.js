// ─────────────────────────────────────────────
//  Suraksha — frontend/js/route.js
// ─────────────────────────────────────────────
// ── Map setup ──────────────────────────────────────────────────────────────────
let map, fromMarker, toMarker, routeLine, dangerMarkers = [];
let fromCoords = null, toCoords = null;
let clickState = 'from'; // 'from' or 'to'

document.addEventListener('DOMContentLoaded', () => {
  map = L.map('routeMap').setView([12.9716, 79.1591], 14); // VIT Vellore default

  L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  attribution: '© Google',
  maxZoom: 20,
}).addTo(map);

  map.on('click', onMapClick);
});

function onMapClick(e) {
  const { lat, lng } = e.latlng;

  if (clickState === 'from') {
    fromCoords = { lat, lng };
    document.getElementById('fromInput').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (fromMarker) map.removeLayer(fromMarker);
    fromMarker = L.marker([lat, lng], {
      icon: colorIcon('green'),
      title: 'From',
    }).addTo(map).bindPopup('Start').openPopup();

    clickState = 'to';

  } else if (clickState === 'to') {
    toCoords = { lat, lng };
    document.getElementById('toInput').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (toMarker) map.removeLayer(toMarker);
    toMarker = L.marker([lat, lng], {
      icon: colorIcon('blue'),
      title: 'To',
    }).addTo(map).bindPopup('Destination').openPopup();

    // Draw straight line preview
    drawRouteLine();

    document.getElementById('checkRouteBtn').disabled = false;
    clickState = 'from'; // reset for next use
  }
}

// REPLACE drawRouteLine():
async function drawRouteLine() {
  if (routeLine) map.removeLayer(routeLine);
  if (!fromCoords || !toCoords) return;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lng},${fromCoords.lat};${toCoords.lng},${toCoords.lat}?overview=full&geometries=geojson`;
    const res  = await fetch(url);
    const data = await res.json();

    const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    routeLine = L.polyline(coords, {
      color: '#4A90D9', weight: 4, dashArray: '6 4'
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  } catch {
    // fallback to straight line
    routeLine = L.polyline(
      [[fromCoords.lat, fromCoords.lng], [toCoords.lat, toCoords.lng]],
      { color: '#4A90D9', weight: 3, dashArray: '6 4' }
    ).addTo(map);
  }
}

// ── API call ───────────────────────────────────────────────────────────────────

// REPLACE checkRoute():
async function checkRoute() {
  if (!fromCoords || !toCoords) return;

  const btn = document.getElementById('checkRouteBtn');
  btn.textContent = 'Checking...';
  btn.disabled = true;

  try {
    // Get real road route from OSRM
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lng},${fromCoords.lat};${toCoords.lng},${toCoords.lat}?overview=full&geometries=geojson`;
    const osrmRes  = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();

    const coords = osrmData.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    // Draw final colored route
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline(coords, {
      color: '#22c55e', weight: 5
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    // Now check safety from your backend
    const params = new URLSearchParams({
      fromLat: fromCoords.lat, fromLng: fromCoords.lng,
      toLat:   toCoords.lat,   toLng:   toCoords.lng,
    });

    const safeRes  = await fetch(`${API_BASE}/safety/route?${params}`);
    const safeData = await safeRes.json();

    // Color route by safety score
    const color = safeData.averageScore >= 70 ? '#22c55e'
                : safeData.averageScore >= 40 ? '#f59e0b'
                : '#ef4444';

    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline(coords, { color, weight: 5 }).addTo(map);

    renderResult(safeData);

  } catch (err) {
    console.error(err);
    renderResult({ averageScore: null, safetyLevel: 'unknown', dangerZones: [] });
  } finally {
    btn.textContent = 'Check Route Safety';
    btn.disabled = false;
  }
}

function renderResult(data) {
  const resultSection = document.getElementById('routeResult');
  resultSection.classList.remove('hidden');

  // Score display
  const scoreDisplay = document.getElementById('scoreDisplay');
  if (data.averageScore === null) {
    scoreDisplay.innerHTML = `<div class="badge badge-grey">No safety data — proceed with caution</div>`;
  } else {
    const colorClass = data.averageScore >= 70 ? 'badge-green'
                     : data.averageScore >= 40 ? 'badge-amber'
                     : 'badge-red';
    const emoji = data.averageScore >= 70 ? '🟢' : data.averageScore >= 40 ? '🟡' : '🔴';
    scoreDisplay.innerHTML = `
      <div class="score-big">${emoji} Route Safety Score: <strong>${data.averageScore}/100</strong></div>
      <div class="badge ${colorClass}">${data.safetyLevel?.toUpperCase() || 'UNKNOWN'}</div>
    `;
  }

  // Danger zones
  const dangerList = document.getElementById('dangerList');
  clearDangerMarkers();

  if (data.dangerZones && data.dangerZones.length > 0) {
    dangerList.innerHTML = `
      <h3 style="color: var(--color-danger, #c0392b); margin-top: 12px;">
        ⚠️ ${data.dangerZones.length} Danger Zone(s) on this route
      </h3>
      ${data.dangerZones.map(z => `
        <div class="danger-zone-item">
          📍 ${z.lat.toFixed(4)}, ${z.lng.toFixed(4)} — Score: ${z.score}
          ${z.riskTags.length > 0 ? '<br>' + z.riskTags.map(t => `<span class="tag">${t}</span>`).join(' ') : ''}
        </div>
      `).join('')}
    `;

    // Add red markers for each danger zone
    data.dangerZones.forEach(z => {
      const m = L.circleMarker([z.lat, z.lng], {
        radius: 10, color: '#e74c3c', fillColor: '#e74c3c', fillOpacity: 0.5, weight: 2,
      }).addTo(map).bindPopup(`⚠️ Score: ${z.score}<br>${z.riskTags.join(', ')}`);
      dangerMarkers.push(m);
    });

  } else {
    dangerList.innerHTML = `<p style="color: green;">✅ No danger zones detected on this route.</p>`;
  }
}

function clearDangerMarkers() {
  dangerMarkers.forEach(m => map.removeLayer(m));
  dangerMarkers = [];
}

function resetRoute() {
  fromCoords = null; toCoords = null; clickState = 'from';
  document.getElementById('fromInput').value = '';
  document.getElementById('toInput').value   = '';
  document.getElementById('checkRouteBtn').disabled = true;
  document.getElementById('routeResult').classList.add('hidden');
  if (fromMarker) map.removeLayer(fromMarker);
  if (toMarker)   map.removeLayer(toMarker);
  if (routeLine)  map.removeLayer(routeLine);
  clearDangerMarkers();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function colorIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}