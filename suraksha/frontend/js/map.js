/* ============================================================
   SURAKSHA — map.js
   Leaflet map: safety score markers, incident heatmap,
   community flags, predictive alerts, real-time refresh
   ============================================================ */

'use strict';

/* ─── Map setup ──────────────────────────────────────────── */
const DEFAULT_CENTER = [12.9716, 79.1575]; // VIT Vellore
const DEFAULT_ZOOM   = 14;

const map = L.map('map', {
  center: DEFAULT_CENTER,
  zoom:   DEFAULT_ZOOM,
  zoomControl: true,
});

// OpenStreetMap tiles (free, no API key)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

/* ─── Layer groups ───────────────────────────────────────── */
const scoreLayers = L.layerGroup().addTo(map);
const flagLayer   = L.layerGroup();
let   heatLayer   = null;

/* ─── State ──────────────────────────────────────────────── */
let flagCoords      = null;
let refreshTimer    = null;
const layerState    = { scores: true, heatmap: true, flags: false };

/* ─── Inject breathing keyframes once ───────────────────── */
(function injectPulseCSS() {
  if (document.getElementById('_suraksha_pulse')) return;
  const s = document.createElement('style');
  s.id = '_suraksha_pulse';
  s.textContent = `
    @keyframes _pulse_red {
      0%,100% { box-shadow: 0 0 0 0px rgba(239,68,68,0.85), 0 0 8px 2px rgba(239,68,68,0.5); transform: scale(1); }
      50%      { box-shadow: 0 0 0 10px rgba(239,68,68,0),   0 0 18px 8px rgba(239,68,68,0.15); transform: scale(1.12); }
    }
    @keyframes _pulse_orange {
      0%,100% { box-shadow: 0 0 0 0px rgba(245,158,11,0.85), 0 0 8px 2px rgba(245,158,11,0.5); transform: scale(1); }
      50%      { box-shadow: 0 0 0 10px rgba(245,158,11,0),   0 0 18px 8px rgba(245,158,11,0.15); transform: scale(1.12); }
    }
    @keyframes _pulse_green {
      0%,100% { box-shadow: 0 0 0 0px rgba(34,197,94,0.85), 0 0 8px 2px rgba(34,197,94,0.5); transform: scale(1); }
      50%      { box-shadow: 0 0 0 10px rgba(34,197,94,0),   0 0 18px 8px rgba(34,197,94,0.15); transform: scale(1.12); }
    }
    .sm-pulse { border-radius: 50%; }
    .sm-pulse:hover { animation-play-state: paused !important; transform: scale(1.2) !important; }
  `;
  document.head.appendChild(s);
})();

/* ─── Custom marker icons ────────────────────────────────── */
function makeIcon(score) {
  const color  = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const anim   = score >= 70 ? '_pulse_green 2.8s ease-in-out infinite'
               : score >= 40 ? '_pulse_orange 2.2s ease-in-out infinite'
               :               '_pulse_red 1.8s ease-in-out infinite';
  const size   = score >= 70 ? 38 : score >= 40 ? 42 : 46;
  const half   = size / 2;

  return L.divIcon({
    className: '',
    html: `
      <div class="sm-pulse" style="
        width:${size}px; height:${size}px; border-radius:50%;
        background:${color}22; border:2.5px solid ${color};
        display:flex; align-items:center; justify-content:center;
        font-family:'Syne',sans-serif; font-size:11px; font-weight:800;
        color:${color}; cursor:pointer;
        animation:${anim};
      ">${score}</div>
    `,
    iconSize:   [size, size],
    iconAnchor: [half, half],
    popupAnchor:[0, -20],
  });
}

function makeFlagIcon(type) {
  const icons = {
    harassment:    '😠',
    poor_lighting: '💡',
    unsafe_crowd:  '👥',
    other:         '⚠️',
  };
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(239,68,68,0.15); border: 2px solid #ef4444;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; cursor: pointer;
      ">${icons[type] || '⚠️'}</div>
    `,
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
    popupAnchor:[0, -16],
  });
}

/* ─── Helpers ────────────────────────────────────────────── */
function scoreToColor(score) {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function scoreToClass(score) {
  if (score >= 70) return 'safe';
  if (score >= 40) return 'warn';
  return 'danger';
}

function scoreToLabel(score) {
  if (score >= 70) return 'Safe';
  if (score >= 40) return 'Caution';
  return 'Unsafe';
}

function formatFlagType(type) {
  const labels = {
    harassment:    'Harassment',
    poor_lighting: 'Poor Lighting',
    unsafe_crowd:  'Unsafe Crowd',
    other:         'Other Concern',
  };
  return labels[type] || type;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/* ─── Load safety scores ─────────────────────────────────── */
// FIX: backend returns { points } from /api/safety/heatmap
// There is no bulk /scores endpoint — we fetch heatmap points
// and render score markers from SafetyScore collection via heatmap data.
async function loadScores() {
  try {
    // Step 1: get heatmap points [ [lat, lng, intensity], ... ]
    const heatData = await apiFetch(API.safetyHeatmap);

    // heatData.points is [[lat, lng, intensity], ...]
    const points = (heatData && heatData.points) ? heatData.points : [];

    scoreLayers.clearLayers();

    let totalScore  = 0;
    let incidentSum = 0;
    const count     = points.length;

    // Render a marker for each heatmap point
    // intensity is (100 - score) / 100, so score = (1 - intensity) * 100
    points.forEach(([lat, lng, intensity]) => {
      const score = Math.round((1 - intensity) * 100);

      const marker = L.marker([lat, lng], { icon: makeIcon(score) });

      marker.bindPopup(`
        <div style="min-width:180px;">
          <div style="font-weight:700; font-size:14px; margin-bottom:6px; color:${scoreToColor(score)};">
            ${scoreToLabel(score)} · ${score}/100
          </div>
          <div style="margin-top:10px; padding-top:8px; border-top:1px solid #2a2e38;">
            <a href="report.html" style="font-size:11px; color:#f5a623; font-weight:600;">
              + Report incident here
            </a>
          </div>
        </div>
      `);

      marker.on('click', () => showScorePanel({ lat, lng, score }));
      scoreLayers.addLayer(marker);

      totalScore += score;
    });

    // Update stats panel
    const n = count || 1;
    const avgEl       = document.getElementById('stat-avg');
    const incidentEl  = document.getElementById('stat-incidents');
    if (avgEl)      avgEl.textContent      = Math.round(totalScore / n);
    if (incidentEl) incidentEl.textContent = count;

    // Step 2: render heatmap
    if (layerState.heatmap) {
      loadHeatmap(points);
    }

  } catch (err) {
    console.error('Failed to load scores:', err);
  }
}

/* ─── Heatmap layer ──────────────────────────────────────── */
function loadHeatmap(points) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  if (!points || !points.length) return;

  heatLayer = L.heatLayer(points, {
    radius:  25,
    blur:    20,
    maxZoom: 17,
    gradient: {
      0.0: '#22c55e',
      0.4: '#f59e0b',
      0.7: '#ef4444',
      1.0: '#7f1d1d',
    },
  });

  if (layerState.heatmap) {
    heatLayer.addTo(map);
  }
}

/* ─── Community flags ────────────────────────────────────── */
// FIX: /api/safety/flag is POST-only (no GET list endpoint)
// Flags are shown from local state only after user submits them.
async function loadFlags() {
  // No GET /api/safety/flags endpoint exists in backend.
  // Flags are shown immediately after POST in the submitFlag handler.
  // This function is a no-op to avoid breaking calls from toggleFlags / startRefresh.
  const flagCountEl = document.getElementById('stat-flags');
  if (flagCountEl) flagCountEl.textContent = flagLayer.getLayers().length;
}

/* ─── Score panel ────────────────────────────────────────── */
function showScorePanel(loc) {
  const cls   = scoreToClass(loc.score);
  const color = scoreToColor(loc.score);
  const label = scoreToLabel(loc.score);

  const scoreContent = document.getElementById('scoreContent');
  if (!scoreContent) return;

  scoreContent.innerHTML = `
    <div class="score-display">
      <div class="score-circle score-circle--${cls}">${loc.score}</div>
      <div>
        <div style="font-size:var(--text-sm); font-weight:700; color:${color}; margin-bottom:4px;">${label}</div>
        <div style="font-size:var(--text-xs); color:var(--clr-text-2); line-height:1.4;">
          ${loc.locationName || 'This area'}
        </div>
      </div>
    </div>
    <div style="margin-top:var(--space-3); display:flex; flex-direction:column; gap:var(--space-2);">
      <div class="progress-group">
        <div class="progress-group__header">
          <span class="progress-group__label" style="font-size:10px;">Safety score</span>
          <span class="progress-group__value" style="font-size:11px;">${loc.score}/100</span>
        </div>
        <div class="progress progress--sm">
          <div class="progress__bar progress__bar--${cls}" style="width:${loc.score}%"></div>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:10px;">
        <span style="color:var(--clr-text-3);">Incidents</span>
        <span style="font-weight:600;">${loc.incidentCount || 0}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:10px;">
        <span style="color:var(--clr-text-3);">Lighting</span>
        <span style="font-weight:600;">${'★'.repeat(loc.lightingRating || 3)}${'☆'.repeat(5 - (loc.lightingRating || 3))}</span>
      </div>
    </div>
  `;

  loadPrediction(loc.lat, loc.lng);
}

/* ─── Predictive alert ───────────────────────────────────── */
async function loadPrediction(lat, lng) {
  const predCard    = document.getElementById('predCard');
  const predContent = document.getElementById('predContent');
  if (!predCard || !predContent) return;

  try {
    const data = await apiFetch(`${API.safetyPredict}?lat=${lat}&lng=${lng}`);

    // Backend returns { predictions: [{hour, label, score, colour}, ...] }
    const predictions = data.predictions || [];
    if (!predictions.length) {
      predCard.style.display = 'none';
      return;
    }

    // Find the worst upcoming slot
    const worst = predictions.reduce((a, b) => a.score < b.score ? a : b);

    predCard.style.display = 'block';
    predContent.innerHTML = `
      <div class="badge badge--${worst.colour === 'red' ? 'danger' : 'warn'}"
           style="margin-bottom:var(--space-3);">
        ${worst.colour === 'red' ? '🚨 High risk' : '⚠ Moderate risk'} predicted
      </div>
      <p style="font-size:var(--text-xs); color:var(--clr-text-2); line-height:1.5;">
        Lowest predicted score: <strong>${worst.score}/100</strong> at ${worst.label}
      </p>
      <div style="margin-top:var(--space-3); display:flex; flex-direction:column; gap:4px;">
        ${predictions.map(p => `
          <div style="display:flex; justify-content:space-between; font-size:10px;">
            <span style="color:var(--clr-text-3);">${p.label}</span>
            <span style="color:${scoreToColor(p.score)}; font-weight:600;">${p.score}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch {
    predCard.style.display = 'none';
  }
}

/* ─── Layer toggles ──────────────────────────────────────── */
document.getElementById('toggleScores').addEventListener('click', function () {
  layerState.scores = !layerState.scores;
  this.classList.toggle('active', layerState.scores);

  if (layerState.scores) {
    scoreLayers.addTo(map);
  } else {
    map.removeLayer(scoreLayers);
  }
});

document.getElementById('toggleHeatmap').addEventListener('click', function () {
  layerState.heatmap = !layerState.heatmap;
  this.classList.toggle('active', layerState.heatmap);

  if (layerState.heatmap && heatLayer) {
    heatLayer.addTo(map);
  } else if (heatLayer) {
    map.removeLayer(heatLayer);
  }
});

document.getElementById('toggleFlags').addEventListener('click', function () {
  layerState.flags = !layerState.flags;
  this.classList.toggle('active', layerState.flags);

  if (layerState.flags) {
    flagLayer.addTo(map);
    loadFlags();
  } else {
    map.removeLayer(flagLayer);
  }
});

/* ─── Locate me ──────────────────────────────────────────── */
document.getElementById('locateMe').addEventListener('click', () => {
  if (!navigator.geolocation) {
    Toast.error('Geolocation not supported.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      map.setView([lat, lng], 16);

      L.circle([lat, lng], {
        radius: 50,
        color:  '#f5a623',
        fillColor: '#f5a62333',
        fillOpacity: 0.4,
        weight: 2,
      }).addTo(map).bindPopup('<b style="color:#f5a623;">You are here</b>').openPopup();

      fetchScoreAtPoint(lat, lng);
    },
    () => Toast.error('Could not get your location.')
  );
});

async function fetchScoreAtPoint(lat, lng) {
  try {
    const data = await apiFetch(`${API.safetyScore}?lat=${lat}&lng=${lng}`);
    showScorePanel({ ...data, lat, lng });
  } catch {
    // Silent fail
  }
}

/* ─── Flag modal ─────────────────────────────────────────── */
document.getElementById('openFlagModal').addEventListener('click', () => {
  const modal  = document.getElementById('flagModal');
  const center = map.getCenter();
  flagCoords   = { lat: center.lat.toFixed(5), lng: center.lng.toFixed(5) };
  const coordEl = document.getElementById('flagCoords');
  if (coordEl) coordEl.textContent = `${flagCoords.lat}, ${flagCoords.lng}`;
  modal.classList.add('visible');
});

// Let user click map to set flag location
map.on('click', (e) => {
  const modal = document.getElementById('flagModal');
  if (modal.classList.contains('visible')) {
    flagCoords = { lat: e.latlng.lat.toFixed(5), lng: e.latlng.lng.toFixed(5) };
    const coordEl = document.getElementById('flagCoords');
    if (coordEl) coordEl.textContent = `${flagCoords.lat}, ${flagCoords.lng}`;
  }
});

window.closeFlagModal = function () {
  document.getElementById('flagModal').classList.remove('visible');
};

document.getElementById('submitFlag').addEventListener('click', async () => {
  const flagType = document.querySelector('input[name="flagType"]:checked')?.value;

  if (!flagType) {
    Toast.warning('Please select the type of concern.');
    return;
  }

  const btn = document.getElementById('submitFlag');
  setLoading(btn, true);

  try {
    await apiFetch(API.safetyFlag, {
      method: 'POST',
      body:   JSON.stringify({
        lat:      parseFloat(flagCoords.lat),
        lng:      parseFloat(flagCoords.lng),
        flagType,
        description: formatFlagType(flagType),
      }),
    });

    Toast.success('Flag submitted anonymously. Thank you!');
    closeFlagModal();

    // Add to map immediately
    if (layerState.flags) {
      L.marker([parseFloat(flagCoords.lat), parseFloat(flagCoords.lng)], {
        icon: makeFlagIcon(flagType),
      })
        .addTo(flagLayer)
        .bindPopup(`<div style="font-size:12px;"><b>${formatFlagType(flagType)}</b><br/>Just now</div>`);
    }

    // Refresh score data after flag
    setTimeout(() => loadScores(), 2000);

  } catch {
    Toast.error('Failed to submit flag. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

/* ─── Map move → reload data ─────────────────────────────── */
let moveDebounce;
map.on('moveend', () => {
  clearTimeout(moveDebounce);
  moveDebounce = setTimeout(loadScores, 500);
});

/* ─── Auto-refresh every 60s ─────────────────────────────── */
function startRefresh() {
  refreshTimer = setInterval(() => {
    loadScores();
    if (layerState.flags) loadFlags();
  }, 60000);
}

/* ─── Init ───────────────────────────────────────────────── */
loadScores();
startRefresh();