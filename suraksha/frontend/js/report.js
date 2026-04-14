/* ============================================================
   SURAKSHA — report.js
   Multi-step complaint form: validation, submission,
   offline queue fallback, token display
   ============================================================ */

'use strict';

/* ─── State ──────────────────────────────────────────────── */
let currentStep  = 1;
const totalSteps = 4;

const formData = {
  category:     '',
  severity:     'medium',
  description:  '',
  incidentDate: '',
  timeOfDay:    '',
  location:     '',
  coordinates:  null,
  allowContact: false,
};

/* ─── DOM refs ───────────────────────────────────────────── */
const formScreen   = document.getElementById('formScreen');
const successScreen = document.getElementById('successScreen');
const reportForm   = document.getElementById('reportForm');
const submitBtn    = document.getElementById('submitBtn');
const displayToken = document.getElementById('displayToken');
const copyTokenBtn = document.getElementById('copyToken');
const descTextarea = document.getElementById('description');
const descCount    = document.getElementById('descCount');

/* ─── Step navigation ────────────────────────────────────── */
function showStep(n) {
  // Hide all steps
  for (let i = 1; i <= totalSteps; i++) {
    const el = document.getElementById(`formStep${i}`);
    if (el) el.style.display = 'none';
  }

  // Show target step
  const target = document.getElementById(`formStep${n}`);
  if (target) {
    target.style.display = 'flex';
    target.style.flexDirection = 'column';
    target.style.gap = 'var(--space-6)';
    target.style.animation = 'fade-up 0.3s var(--ease-out) both';
  }

  // Update step indicators
  for (let i = 1; i <= totalSteps; i++) {
    const dot = document.getElementById(`step${i}`);
    if (!dot) continue;
    dot.classList.remove('step--active', 'step--done');
    if (i < n)  dot.classList.add('step--done');
    if (i === n) dot.classList.add('step--active');
    dot.querySelector('.step__dot').textContent = i < n ? '✓' : i;
  }

  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── Severity buttons ───────────────────────────────────── */
document.querySelectorAll('.severity-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    formData.severity = btn.dataset.level;
    document.getElementById('severityInput').value = btn.dataset.level;
  });
});

/* ─── Character count ────────────────────────────────────── */
descTextarea.addEventListener('input', () => {
  const len = descTextarea.value.length;
  descCount.textContent = `${len} / 2000`;
  descCount.className = 'char-count';
  if (len > 1800) descCount.classList.add('char-count--warn');
  if (len >= 2000) descCount.classList.add('char-count--over');
  formData.description = descTextarea.value;
});

/* ─── Step 1 validation & next ───────────────────────────── */
document.getElementById('nextStep1').addEventListener('click', () => {
  const selected = document.querySelector('input[name="category"]:checked');
  const errEl    = document.getElementById('categoryError');

  if (!selected) {
    errEl.style.display = 'flex';
    return;
  }

  errEl.style.display = 'none';
  formData.category = selected.value;

  // Populate review
  document.getElementById('reviewCategory').textContent =
    selected.closest('.category-pill').querySelector('label').textContent.trim();
  document.getElementById('reviewSeverity').textContent =
    formData.severity.charAt(0).toUpperCase() + formData.severity.slice(1);

  showStep(2);
});

/* ─── Step 2 validation & next ───────────────────────────── */
document.getElementById('nextStep2').addEventListener('click', () => {
  const desc  = descTextarea.value.trim();
  const errEl = document.getElementById('descError');

  if (desc.length < 20) {
    errEl.style.display = 'flex';
    descTextarea.classList.add('input--error');
    return;
  }

  errEl.style.display = 'none';
  descTextarea.classList.remove('input--error');
  formData.description  = desc;
  formData.incidentDate = document.getElementById('incidentDate').value;
  formData.timeOfDay    = document.getElementById('timeOfDay').value;

  document.getElementById('reviewDescription').textContent =
    desc.length > 200 ? desc.slice(0, 200) + '...' : desc;

  showStep(3);
});

/* ─── Step 3 location & next ─────────────────────────────── */
document.getElementById('useLocation').addEventListener('click', () => {
  const statusEl = document.getElementById('locationStatus');
  const btn      = document.getElementById('useLocation');

  if (!navigator.geolocation) {
    statusEl.textContent = 'Geolocation not supported in this browser.';
    return;
  }

  btn.textContent = '📡 Getting location...';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      formData.coordinates = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      statusEl.textContent = `✓ Location captured: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      statusEl.style.color = 'var(--clr-safe)';
      btn.textContent = '📍 Location captured';
      btn.disabled = false;
    },
    err => {
      statusEl.textContent = 'Could not get location. You can type it manually.';
      statusEl.style.color = 'var(--clr-text-3)';
      btn.textContent = '📍 Use my current location';
      btn.disabled = false;
    }
  );
});

document.getElementById('nextStep3').addEventListener('click', () => {
  formData.location     = document.getElementById('location').value.trim();
  formData.allowContact = document.getElementById('allowContact').checked;

  document.getElementById('reviewLocation').textContent =
    formData.location || 'Not specified';

  showStep(4);
});

/* ─── Back buttons ───────────────────────────────────────── */
document.getElementById('backStep2').addEventListener('click', () => showStep(1));
document.getElementById('backStep3').addEventListener('click', () => showStep(2));
document.getElementById('backStep4').addEventListener('click', () => showStep(3));

/* ─── Form Submit ────────────────────────────────────────── */
reportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading(submitBtn, true);

  // Generate anonymous token client-side
  const token = crypto.randomUUID();

  const payload = {
    anonymousToken: token,
    category:       document.querySelector('input[name="category"]:checked')?.value || 'other',
    severity:       formData.severity,
    description:    descTextarea.value.trim(),
    incidentDate:   formData.incidentDate || new Date().toISOString(),
    timeOfDay:      formData.timeOfDay,
    location:       formData.location,
    coordinates:    formData.coordinates,
    allowContact:   formData.allowContact,
  };

  try {
    if (!navigator.onLine) {
      // Offline — save to IndexedDB queue
      await OfflineQueue.enqueue(payload);
      TokenManager.set(token);
      showSuccess(token);
      Toast.warning('You\'re offline. Report saved and will submit when you reconnect.', 6000);
      return;
    }

    // Online — submit to API
    const result = await apiFetch(API.complaints, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Store token in localStorage for easy tracking
    TokenManager.set(token);

    // Also store complaint ID for evidence linking
    if (result.id) {
      localStorage.setItem('suraksha_complaint_id', result.id);
    }

    showSuccess(token);
    Toast.success('Report submitted successfully!');

  } catch (err) {
    // Network error — fallback to offline queue
    try {
      await OfflineQueue.enqueue(payload);
      TokenManager.set(token);
      showSuccess(token);
      Toast.warning('Could not reach server. Report saved offline and will sync later.', 6000);
    } catch {
      Toast.error('Failed to save report. Please try again.');
      setLoading(submitBtn, false);
    }
  }
});

/* ─── Show success screen ────────────────────────────────── */
function showSuccess(token) {
  formScreen.classList.add('hidden');
  successScreen.classList.add('visible');
  displayToken.textContent = token;
  setLoading(submitBtn, false);
}

/* ─── Copy token ─────────────────────────────────────────── */
copyTokenBtn.addEventListener('click', () => {
  const token = displayToken.textContent;
  copyToClipboard(token);
  copyTokenBtn.textContent = 'Copied ✓';
  setTimeout(() => { copyTokenBtn.textContent = 'Copy'; }, 2000);
});

/* ─── File another report ────────────────────────────────── */
document.getElementById('newReport').addEventListener('click', () => {
  // Reset form
  reportForm.reset();
  Object.assign(formData, {
    category: '', severity: 'medium', description: '',
    incidentDate: '', timeOfDay: '', location: '', coordinates: null, allowContact: false,
  });
  descCount.textContent = '0 / 2000';

  // Reset severity buttons
  document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-level="medium"]').classList.add('active');

  // Reset screens
  formScreen.classList.remove('hidden');
  successScreen.classList.remove('visible');
  showStep(1);
});

/* ─── Init ───────────────────────────────────────────────── */
showStep(1);