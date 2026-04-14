// ── Legal Report Generator ─────────────────────────────────────────────────────
// Called from track.html or evidence.html once the user has their token.
// Fetches complaint + evidence, sends to /api/report/generate, downloads PDF.

async function generateLegalReport() {
  const token = getToken(); // from app.js helper
  if (!token) {
    return alert('No complaint token found. File a complaint first.');
  }

  // Get any laws the user selected from legal.html
  let laws = [];
  try {
    laws = JSON.parse(localStorage.getItem('suraksha_selected_laws')) || [];
  } catch {
    laws = [];
  }

  const btn = document.getElementById('generateReportBtn');
  if (btn) {
    btn.textContent = 'Generating PDF...';
    btn.disabled    = true;
  }

  try {
    const res = await fetch(`${API_BASE}/report/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, laws }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Server error');
    }

    // Stream PDF blob and trigger download
    const blob     = await res.blob();
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `suraksha-report-${token.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error('Report generation failed:', err);
    alert(`Failed to generate report: ${err.message}`);
  } finally {
    if (btn) {
      btn.textContent = 'Download Legal Report (PDF)';
      btn.disabled    = false;
    }
  }
}

// ── Utility: add the button anywhere in a page ─────────────────────────────────
// Call this from track.html or evidence.html after a token is confirmed:
//
//   addReportButton(document.getElementById('actionsSection'));

function addReportButton(container) {
  if (!container) return;
  const btn      = document.createElement('button');
  btn.id         = 'generateReportBtn';
  btn.className  = 'btn-primary';
  btn.textContent = 'Download Legal Report (PDF)';
  btn.onclick    = generateLegalReport;
  container.appendChild(btn);
}