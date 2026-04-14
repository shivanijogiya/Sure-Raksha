/* ============================================================
   SURAKSHA — track.js
   Complaint status tracking: token input, API fetch,
   timeline rendering, auto-refresh
   ============================================================ */

'use strict';

const tokenInput  = document.getElementById('tokenInput');
const trackBtn    = document.getElementById('trackBtn');
const resultArea  = document.getElementById('resultArea');
const tokenHint   = document.getElementById('tokenHint');

let refreshTimer  = null;
let currentToken  = null;

/* ─── Init: auto-load saved token ───────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const saved = TokenManager.get();
  if (saved) {
    tokenInput.value = saved;
    tokenHint.innerHTML = `
      ✓ Token loaded from your saved session.
      <button onclick="TokenManager.clear(); tokenInput.value=''; location.reload();"
              style="background:none;border:none;color:var(--clr-danger);cursor:pointer;
                     font-size:inherit;padding:0;margin-left:4px;text-decoration:underline;">
        Clear
      </button>
    `;
    fetchReport(saved);
  }
});

/* ─── Track button ───────────────────────────────────────── */
trackBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) {
    tokenInput.classList.add('input--error');
    tokenHint.textContent = '⚠ Please enter your tracking token.';
    tokenHint.style.color = 'var(--clr-danger)';
    return;
  }

  tokenInput.classList.remove('input--error');
  fetchReport(token);
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') trackBtn.click();
});

/* ─── Fetch report ───────────────────────────────────────── */
async function fetchReport(token) {
  currentToken = token;
  setLoading(trackBtn, true);
  showSkeleton();

  try {
    const data = await apiFetch(`${API.complaints}/${encodeURIComponent(token)}`);
    renderResult(data);
    startAutoRefresh(token);
  } catch (err) {
    if (err.message.includes('404') || err.message.toLowerCase().includes('not found')) {
      showNotFound();
    } else {
      showError(err.message);
    }
  } finally {
    setLoading(trackBtn, false);
  }
}

/* ─── Render result ──────────────────────────────────────── */
function renderResult(report) {
  // Clone template
  const tpl = document.getElementById('resultTemplate');
  const clone = tpl.content.cloneNode(true);

  // Status badge
  const cfg = getStatusConfig(report.status);
  const badge = clone.getElementById('tpl-status-badge');
  badge.className = `badge badge--${cfg.class}`;
  badge.innerHTML = `<span class="badge__dot badge__dot--pulse"></span> ${cfg.icon} ${cfg.label}`;

  // Fields
  clone.getElementById('tpl-filed-date').textContent  = formatDate(report.createdAt);
  clone.getElementById('tpl-category').textContent    = formatCategory(report.category);
  clone.getElementById('tpl-severity').textContent    = capitalize(report.severity || 'medium');
  clone.getElementById('tpl-location').textContent    = report.location || 'Not specified';
  clone.getElementById('tpl-description').textContent = report.description;

  // Timeline
  const timelineEl = clone.getElementById('tpl-timeline');
  timelineEl.innerHTML = buildTimeline(report);

  // Last updated
  clone.getElementById('tpl-last-updated').textContent = 'just now';

  // Replace result area
  resultArea.innerHTML = '';
  resultArea.appendChild(clone);
}

/* ─── Build timeline HTML ────────────────────────────────── */
function buildTimeline(report) {
  const stages = [
    { key: 'submitted',    label: 'Submitted',    icon: '📨', desc: 'Report received and logged anonymously.' },
    { key: 'under_review', label: 'Under Review', icon: '🔍', desc: 'A reviewer is assessing your complaint.' },
    { key: 'escalated',    label: 'Escalated',    icon: '🚨', desc: 'Referred to relevant authorities with evidence.' },
    { key: 'resolved',     label: 'Resolved',     icon: '✅', desc: 'Action has been taken. Case closed.' },
  ];

  const currentStepNum = getStatusConfig(report.status).step;

  // Build history map keyed by status
  const historyMap = {};
  (report.statusHistory || []).forEach(h => {
    historyMap[h.status] = h;
  });

  return stages.map((stage, idx) => {
    const isDone    = idx < currentStepNum;
    const isActive  = idx === currentStepNum;
    const isPending = idx > currentStepNum;

    const stateClass = isDone
      ? 'timeline-item--done'
      : isActive
        ? 'timeline-item--active'
        : 'timeline-item--pending';

    const histEntry = historyMap[stage.key];
    const timeStr   = histEntry ? formatDate(histEntry.updatedAt) : '';
    const noteStr   = histEntry?.note
      ? `<div class="timeline-item__note">${histEntry.note}</div>`
      : '';

    return `
      <div class="timeline-item ${stateClass}">
        <div class="timeline-item__dot">
          ${isDone ? '✓' : stage.icon}
        </div>
        <div class="timeline-item__content">
          <div class="timeline-item__header">
            <div class="timeline-item__title">${stage.label}</div>
            ${timeStr ? `<div class="timeline-item__time">${timeStr}</div>` : ''}
          </div>
          <div class="timeline-item__desc">${stage.desc}</div>
          ${noteStr}
        </div>
      </div>
    `;
  }).join('');
}

/* ─── Skeleton loading ───────────────────────────────────── */
function showSkeleton() {
  resultArea.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:var(--space-6);">
      <div class="skeleton-block">
        <div class="skeleton skeleton--title" style="width:40%;"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text" style="width:70%;"></div>
        <div class="skeleton skeleton--text" style="width:55%;"></div>
      </div>
      <div class="skeleton-block">
        <div class="skeleton skeleton--title" style="width:30%;"></div>
        <div class="skeleton skeleton--card"></div>
      </div>
    </div>
  `;
}

/* ─── Not found state ────────────────────────────────────── */
function showNotFound() {
  resultArea.innerHTML = `
    <div class="detail-card">
      <div class="track-empty">
        <div style="font-size:3rem;">🔍</div>
        <h3 style="font-size:var(--text-lg); font-weight:700; color:var(--clr-text-2);">
          No report found
        </h3>
        <p style="font-size:var(--text-sm); color:var(--clr-text-3); max-width:320px;">
          We couldn't find a report matching that token.
          Please check the token and try again.
        </p>
        <a href="report.html" class="btn btn--primary btn--sm" style="margin-top:var(--space-4);">
          File a new report
        </a>
      </div>
    </div>
  `;
  stopAutoRefresh();
}

/* ─── Error state ────────────────────────────────────────── */
function showError(msg) {
  resultArea.innerHTML = `
    <div class="alert alert--danger">
      <span class="alert__icon">⚠</span>
      <span>Could not fetch report: ${msg}. Please check your connection and try again.</span>
    </div>
  `;
  stopAutoRefresh();
}

/* ─── Auto-refresh every 30s ─────────────────────────────── */
function startAutoRefresh(token) {
  stopAutoRefresh();
  refreshTimer = setInterval(async () => {
    try {
      const data = await apiFetch(`${API.complaints}/${encodeURIComponent(token)}`);
      renderResult(data);
    } catch {
      // Silent fail on refresh
    }
  }, 30000);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// Stop refresh when user leaves page
window.addEventListener('beforeunload', stopAutoRefresh);

/* ─── Helpers ────────────────────────────────────────────── */
function formatCategory(cat) {
  const map = {
    harassment:          'Verbal Harassment',
    stalking:            'Stalking / Following',
    physical_assault:    'Physical Assault',
    unsafe_area:         'Unsafe Area / Route',
    digital_harassment:  'Digital Harassment',
    other:               'Other',
  };
  return map[cat] || cat;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
}