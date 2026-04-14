// ── EmailJS Config ─────────────────────────────────────────────────────────────
const EMAILJS_PUBLIC_KEY = 'MO0vJVBwAJCNqbYiz';
const EMAILJS_SERVICE_ID = 'service_2ssfbiu';
const EMAILJS_TEMPLATE_ID = 'template_h2ioier';

// ── Storage ────────────────────────────────────────────────────────────────────
// Contacts stored in localStorage (no login, no server identity).
// Key: 'suraksha_contacts' → JSON array of { id, name, phone, email, alertEnabled }
//frontend/js/contacts.js
const STORAGE_KEY = 'suraksha_contacts';
let watchId = null;
let autoSOSInterval = null; // tracks the 5-min repeat timer

document.addEventListener('DOMContentLoaded', () => {
  // Initialise EmailJS
  emailjs.init(EMAILJS_PUBLIC_KEY);
  renderContacts();
});

// ── CRUD ───────────────────────────────────────────────────────────────────────

function getContacts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveContacts(contacts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

function addContact() {
  const name = document.getElementById('contactName').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const email = document.getElementById('contactEmail').value.trim();

  if (!name) return alert('Please enter a name.');
  if (!phone) return alert('Please enter a phone number.');
  // email is optional but validated if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return alert('Please enter a valid email address, or leave it blank.');
  }

  const contacts = getContacts();
  contacts.push({
    id: crypto.randomUUID(),
    name,
    phone,
    email: email || '',
    alertEnabled: true,
  });
  saveContacts(contacts);

  document.getElementById('contactName').value = '';
  document.getElementById('contactPhone').value = '';
  document.getElementById('contactEmail').value = '';

  renderContacts();
}

function deleteContact(id) {
  const updated = getContacts().filter(c => c.id !== id);
  saveContacts(updated);
  renderContacts();
}

function toggleAlert(id) {
  const contacts = getContacts().map(c => {
    if (c.id === id) return { ...c, alertEnabled: !c.alertEnabled };
    return c;
  });
  saveContacts(contacts);
  renderContacts();
}

function renderContacts() {
  const contacts = getContacts();
  const list = document.getElementById('contactsList');

  if (contacts.length === 0) {
    list.innerHTML = '<p class="empty-state">No contacts added yet.</p>';
    return;
  }

  list.innerHTML = contacts.map(c => `
    <div class="contact-item">
      <div class="contact-info">
        <strong>${escapeHtml(c.name)}</strong>
        <span class="contact-phone">${escapeHtml(c.phone)}</span>
        ${c.email ? `<span class="contact-email" style="font-size:0.8em;color:var(--clr-text-3);">✉ ${escapeHtml(c.email)}</span>` : ''}
      </div>
      <div class="contact-actions">
        <label class="toggle-label">
          <input type="checkbox" ${c.alertEnabled ? 'checked' : ''}
            onchange="toggleAlert('${c.id}')" />
          Alerts
        </label>
        <button class="btn-icon btn-danger-soft" onclick="deleteContact('${c.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

// ── Offline SMS SOS ────────────────────────────────────────────────────────────

function sendOfflineSMS() {
  const contacts = getContacts().filter(c => c.alertEnabled);
  const statusEl = document.getElementById('offlineSMSStatus');

  const message = encodeURIComponent(
    `🚨 SURAKSHA SOS ALERT\nI need help. Please contact me or call emergency services immediately.\n\nSent from Suraksha Safety App.`
  );

  if (contacts.length === 0) {
    statusEl.textContent = '⚠ No contacts with alerts enabled. Opening SMS — enter a number manually.';
    window.location.href = `sms:?body=${message}`;
    return;
  }

  statusEl.textContent = `📩 Opening SMS app for ${contacts.length} contact(s)...`;

  // iOS uses commas, Android uses semicolons for multi-recipient SMS URIs
  const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? ',' : ';';
  const recipients = contacts.map(c => c.phone.replace(/\D/g, '')).join(separator);

  window.location.href = `sms:${recipients}?body=${message}`;
}

// ── Email SOS via EmailJS ──────────────────────────────────────────────────────

async function sendEmailSOS(lat, lng, time) {
  const contacts = getContacts().filter(c => c.alertEnabled && c.email);
  if (contacts.length === 0) return { sent: 0, failed: 0 };

  const mapsLink = lat && lng
    ? `https://maps.google.com/?q=${lat},${lng}`
    : 'Location unavailable';

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_name: contact.name,
        to_email: contact.email,
        from_name: 'Suraksha Safety App',
        time: time,
        location_link: mapsLink,
      });
      sent++;
    } catch (err) {
      console.error(`EmailJS failed for ${contact.email}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}

// ── Auto SOS — sends location every 5 minutes ──────────────────────────────────

function startAutoSOS() {
  const contacts = getContacts().filter(c => c.alertEnabled);
  const statusEl = document.getElementById('locationStatus');

  if (contacts.length === 0) {
    statusEl.textContent = '⚠ No contacts with alerts enabled. Add a contact first.';
    return;
  }

  if (!navigator.geolocation) {
    statusEl.textContent = '⚠ Geolocation not supported by your browser.';
    return;
  }

  statusEl.textContent = '📡 Getting location...';
  statusEl.style.color = '';
  document.getElementById('sosBtn').disabled = true;
  document.getElementById('stopBtn').style.display = 'inline-block';

  // Fire immediately, then repeat every 5 minutes
  sendLocationNow(contacts, statusEl);
  autoSOSInterval = setInterval(() => sendLocationNow(contacts, statusEl), 5 * 60 * 1000);
}

async function sendLocationNow(contacts, statusEl) {
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;

      const time = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
      });

      const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
      const message = encodeURIComponent(
        `🚨 SURAKSHA SOS ALERT\nI need help. Live location at ${time}:\n${mapsLink}\n\nThis alert repeats every 5 minutes.`
      );

      statusEl.textContent = `📡 Sending alerts at ${time} — ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      statusEl.style.color = 'var(--clr-safe)';

      // ── WhatsApp / SMS (existing behaviour) ──
      contacts.forEach((contact, i) => {
        const phone = contact.phone.replace(/\D/g, '');
        setTimeout(() => {
          if (navigator.onLine) {
            window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
          } else {
            window.location.href = `sms:${phone}?body=${message}`;
          }
        }, i * 600);
      });

      // ── Email SOS (new) ──
      if (navigator.onLine) {
        const emailContacts = contacts.filter(c => c.email);
        if (emailContacts.length > 0) {
          const { sent, failed } = await sendEmailSOS(lat, lng, time);
          const emailNote = sent > 0
            ? ` | 📧 Email sent to ${sent} contact${sent > 1 ? 's' : ''}`
            : '';
          const failNote = failed > 0 ? ` (${failed} email failed)` : '';
          statusEl.textContent += emailNote + failNote;
        }
      } else {
        statusEl.textContent += ' | 📧 Email skipped (offline)';
      }
    },
    err => {
      console.warn('Geolocation error:', err);
      statusEl.textContent = '⚠ Could not get location. Retrying in 5 minutes...';
      statusEl.style.color = 'var(--clr-warn)';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function stopAutoSOS() {
  if (autoSOSInterval) {
    clearInterval(autoSOSInterval);
    autoSOSInterval = null;
  }
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  const statusEl = document.getElementById('locationStatus');
  statusEl.textContent = 'SOS stopped.';
  statusEl.style.color = 'var(--clr-text-3)';

  const sosBtn = document.getElementById('sosBtn');
  sosBtn.disabled = false;
  sosBtn.textContent = '🚨 Start SOS';
  document.getElementById('stopBtn').style.display = 'none';
}

// ── Manual Email SOS button ────────────────────────────────────────────────────

async function sendManualEmailSOS() {
  const emailStatusEl = document.getElementById('emailSOSStatus');
  const btn = document.getElementById('emailSOSBtn');
  const emailContacts = getContacts().filter(c => c.alertEnabled && c.email);

  if (emailContacts.length === 0) {
    emailStatusEl.textContent = '⚠ No contacts with an email address. Add an email to a contact first.';
    emailStatusEl.style.color = 'var(--clr-warn)';
    return;
  }

  btn.disabled = true;
  emailStatusEl.textContent = '📧 Sending email alerts...';
  emailStatusEl.style.color = '';

  let lat = null, lng = null;
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Try to get location first (non-blocking — if it fails we still send)
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 1000
      });
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch {
    // location unavailable — email will still go without coords
  }

  const { sent, failed } = await sendEmailSOS(lat, lng, time);

  if (sent > 0) {
    emailStatusEl.textContent = `✅ Email SOS sent to ${sent} contact${sent > 1 ? 's' : ''} at ${time}.`;
    emailStatusEl.style.color = 'var(--clr-safe)';
  } else {
    emailStatusEl.textContent = `❌ Failed to send email SOS. Check your internet connection.`;
    emailStatusEl.style.color = 'var(--clr-warn)';
  }

  btn.disabled = false;
}

// ── Utility ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}