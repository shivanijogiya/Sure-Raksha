/* ============================================================
   SURAKSHA — frontend/js/app.js
   Shared utilities: API config, token management,
   toast notifications, offline detection, helpers
   ============================================================ */

'use strict';

/* ─── API Config ─────────────────────────────────────────── */
const API_BASE = 'http://localhost:3000/api';

const API = {
  complaints:     `${API_BASE}/complaints`,
  evidence:       `${API_BASE}/evidence`,
  safetyScore:    `${API_BASE}/safety/score`,
  safetyHeatmap:  `${API_BASE}/safety/heatmap`,
  safetyFlag:     `${API_BASE}/safety/flag`,
  safetyPredict:  `${API_BASE}/safety/predict`,
  safetyRoute:    `${API_BASE}/safety/route`,
  safetyTags:     `${API_BASE}/safety/tags`,
  report:         `${API_BASE}/report/generate`,
  contacts:       `${API_BASE}/contacts`,
};

/* ─── Anonymous Token ────────────────────────────────────── */
const TokenManager = {
  KEY: 'suraksha_token',

  get() {
    return localStorage.getItem(this.KEY);
  },

  set(token) {
    localStorage.setItem(this.KEY, token);
  },

  generate() {
    const token = crypto.randomUUID();
    this.set(token);
    return token;
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },

  exists() {
    return !!this.get();
  }
};

/* ─── Offline Queue (IndexedDB) ──────────────────────────── */
const OfflineQueue = {
  DB_NAME: 'suraksha_offline',
  STORE:   'queue',
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(this.STORE, {
          keyPath: 'id',
          autoIncrement: true
        });
      };
      req.onsuccess = e => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  },

  async enqueue(payload) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx    = this.db.transaction(this.STORE, 'readwrite');
      const store = tx.objectStore(this.STORE);
      store.add({ payload, timestamp: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  },

  async getAll() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx    = this.db.transaction(this.STORE, 'readonly');
      const store = tx.objectStore(this.STORE);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  async remove(id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx    = this.db.transaction(this.STORE, 'readwrite');
      const store = tx.objectStore(this.STORE);
      store.delete(id);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }
};

/* ─── HTTP Helper ────────────────────────────────────────── */
async function apiFetch(url, options = {}) {
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };

  const config = {
    ...defaults,
    ...options,
    headers: { ...defaults.headers, ...options.headers },
  };

  if (config.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/* ─── Toast Notifications ────────────────────────────────── */
const Toast = (() => {
  let container;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'info', duration = 4000) {
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span style="font-size:1rem; flex-shrink:0;">${icons[type] || icons.info}</span>
      <span style="flex:1; font-size:var(--text-sm);">${message}</span>
      <button onclick="this.parentElement.remove()"
              style="background:none;border:none;color:var(--clr-text-3);cursor:pointer;
                     font-size:1rem;padding:0;flex-shrink:0;line-height:1;">✕</button>
    `;

    getContainer().appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add('toast--leaving');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
      }, duration);
    }

    return toast;
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error', dur),
    info:    (msg, dur) => show(msg, 'info', dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
  };
})();

/* ─── SHA-256 Hash (browser Web Crypto) ──────────────────── */
async function sha256File(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256String(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ─── Format Helpers ─────────────────────────────────────── */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function truncateHash(hash, chars = 8) {
  if (!hash) return '';
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    Toast.success('Copied to clipboard!', 2000);
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    Toast.success('Copied!', 2000);
  });
}

/* ─── Safety Score Helpers ───────────────────────────────── */
function scoreToClass(score) {
  if (score >= 70) return 'safe';
  if (score >= 40) return 'warn';
  return 'danger';
}

function scoreToLabel(score) {
  if (score >= 70) return 'Safe';
  if (score >= 40) return 'Caution';
  return 'High Risk';
}

function scoreToColor(score) {
  if (score >= 70) return 'var(--clr-safe)';
  if (score >= 40) return 'var(--clr-warn)';
  return 'var(--clr-danger)';
}

/* ─── Status Helpers ─────────────────────────────────────── */
const STATUS_CONFIG = {
  submitted:    { label: 'Submitted',    class: 'info',    icon: '📨', step: 0 },
  under_review: { label: 'Under Review', class: 'warn',    icon: '🔍', step: 1 },
  escalated:    { label: 'Escalated',    class: 'danger',  icon: '🚨', step: 2 },
  resolved:     { label: 'Resolved',     class: 'safe',    icon: '✅', step: 3 },
};

function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
}

/* ─── Offline Detection ──────────────────────────────────── */
function initOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;

  function update() {
    if (!navigator.onLine) {
      banner.classList.add('visible');
    } else {
      banner.classList.remove('visible');
      flushOfflineQueue();
    }
  }

  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

async function flushOfflineQueue() {
  try {
    const items = await OfflineQueue.getAll();
    if (!items.length) return;

    Toast.info(`Syncing ${items.length} offline report(s)...`);

    for (const item of items) {
      try {
        await apiFetch(API.complaints, {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
        await OfflineQueue.remove(item.id);
      } catch {
        // Will retry next time online
      }
    }

    Toast.success('Offline reports synced successfully!');
  } catch {
    // IndexedDB not available — silently skip
  }
}

/* ─── DOM Helpers ────────────────────────────────────────── */
function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add('btn--loading');
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.querySelector('.btn__text') && (btn.querySelector('.btn__text').style.opacity = '0');
  } else {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
    if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
  }
}

/* ─── Init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initOfflineBanner();
  OfflineQueue.init().catch(() => {});

  qsa('.navbar__link').forEach(link => {
    if (window.location.pathname.endsWith(link.getAttribute('href'))) {
      link.classList.add('navbar__link--active');
    }
  });

  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }
});