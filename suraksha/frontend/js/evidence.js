/* ============================================================
   SURAKSHA — evidence.js
   File upload pipeline:
   1. Select files
   2. SHA-256 hash each file in-browser (Web Crypto)
   3. Upload to backend → IPFS via Pinata
   4. Blockchain timestamp via smart contract
   ============================================================ */

'use strict';

/* ─── State ──────────────────────────────────────────────── */
let selectedFiles  = [];   // { file, hash, status, ipfsCid, txHash }
let complaintToken = null;
let complaintId    = null;

/* ─── DOM refs ───────────────────────────────────────────── */
const dropZone        = document.getElementById('dropZone');
const fileInput       = document.getElementById('fileInput');
const fileList        = document.getElementById('fileList');
const uploadActions   = document.getElementById('uploadActions');
const uploadSummary   = document.getElementById('uploadSummary');
const uploadBtn       = document.getElementById('uploadBtn');
const clearFilesBtn   = document.getElementById('clearFiles');
const overallProgress = document.getElementById('overallProgress');
const progressBar     = document.getElementById('progressBar');
const progressLabel   = document.getElementById('progressLabel');
const progressPct     = document.getElementById('progressPct');
const uploadedCard    = document.getElementById('uploadedCard');
const uploadedList    = document.getElementById('uploadedList');
const uploadedCount   = document.getElementById('uploadedCount');
const linkedToken     = document.getElementById('linkedToken');
const tokenPrompt     = document.getElementById('tokenPrompt');
const changeTokenBtn  = document.getElementById('changeToken');

/* ─── Init: load token ───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  complaintToken = TokenManager.get();
  complaintId    = localStorage.getItem('suraksha_complaint_id');

  if (complaintToken) {
    linkedToken.textContent = truncateHash(complaintToken, 8);
    tokenPrompt.style.display = 'none';
  } else {
    linkedToken.textContent = 'Not linked';
    tokenPrompt.style.display = 'block';
  }
});

/* ─── Link token manually ─────────────────────────────────── */
document.getElementById('linkToken').addEventListener('click', () => {
  const val = document.getElementById('evidenceToken').value.trim();
  if (!val) return;
  complaintToken = val;
  TokenManager.set(val);
  linkedToken.textContent = truncateHash(val, 8);
  tokenPrompt.style.display = 'none';
  Toast.success('Token linked!');
});

changeTokenBtn.addEventListener('click', () => {
  tokenPrompt.style.display = tokenPrompt.style.display === 'none' ? 'block' : 'none';
});

/* ─── Drag & Drop ─────────────────────────────────────────── */
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('file-zone--dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('file-zone--dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('file-zone--dragover');
  const files = Array.from(e.dataTransfer.files);
  addFiles(files);
});

fileInput.addEventListener('change', () => {
  addFiles(Array.from(fileInput.files));
  fileInput.value = ''; // reset so same file can be re-added
});

/* ─── Add files to list ───────────────────────────────────── */
function addFiles(files) {
  const MAX_SIZE  = 20 * 1024 * 1024; // 20 MB — matches backend multer limit
  const MAX_FILES = 10;

  files.forEach(file => {
    if (selectedFiles.length >= MAX_FILES) {
      Toast.warning(`Maximum ${MAX_FILES} files allowed.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      Toast.error(`"${file.name}" exceeds 20 MB limit.`);
      return;
    }
    if (selectedFiles.find(f => f.file.name === file.name && f.file.size === file.size)) {
      Toast.warning(`"${file.name}" already added.`);
      return;
    }

    selectedFiles.push({
      id:      crypto.randomUUID(),
      file,
      hash:    null,
      status:  'pending',   // pending | hashing | hashed | uploading | done | error
      ipfsCid: null,
      txHash:  null,
      error:   null,
    });
  });

  renderFileList();
  updateUploadActions();
}

/* ─── Render file list ────────────────────────────────────── */
function renderFileList() {
  if (!selectedFiles.length) {
    fileList.innerHTML = '';
    return;
  }

  fileList.innerHTML = selectedFiles.map(item => `
    <div class="file-item" id="file-item-${item.id}">
      <div class="file-item__icon">${fileIcon(item.file.type)}</div>
      <div class="file-item__info">
        <div class="file-item__name">${item.file.name}</div>
        <div class="file-item__meta">
          ${formatFileSize(item.file.size)} · ${item.file.type || 'unknown'}
        </div>
        ${item.hash
          ? `<div class="file-item__hash">SHA-256: ${item.hash}</div>`
          : ''}
      </div>
      <div class="file-item__status">
        ${statusBadge(item)}
      </div>
      ${item.status === 'pending'
        ? `<button class="file-item__remove" onclick="removeFile('${item.id}')">✕</button>`
        : ''}
    </div>
  `).join('');
}

function statusBadge(item) {
  const map = {
    pending:   `<span class="badge badge--neutral">Queued</span>`,
    hashing:   `<span class="badge badge--info"><span class="badge__dot badge__dot--pulse"></span> Hashing...</span>`,
    hashed:    `<span class="badge badge--accent">✓ Hashed</span>`,
    uploading: `<span class="badge badge--info"><span class="badge__dot badge__dot--pulse"></span> Uploading...</span>`,
    done:      `<span class="badge badge--safe">✓ Secured</span>`,
    error:     `<span class="badge badge--danger">✕ Error</span>`,
  };
  return map[item.status] || '';
}

function fileIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/'))  return '🖼️';
  if (mimeType.startsWith('audio/'))  return '🎵';
  if (mimeType.startsWith('video/'))  return '🎬';
  if (mimeType.includes('pdf'))       return '📕';
  return '📄';
}

function removeFile(id) {
  selectedFiles = selectedFiles.filter(f => f.id !== id);
  renderFileList();
  updateUploadActions();
}

function updateUploadActions() {
  if (selectedFiles.length === 0) {
    uploadActions.style.display = 'none';
    return;
  }
  uploadActions.style.display = 'block';
  uploadSummary.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected (${formatFileSize(selectedFiles.reduce((s, f) => s + f.file.size, 0))})`;
}

clearFilesBtn.addEventListener('click', () => {
  selectedFiles = [];
  renderFileList();
  updateUploadActions();
});

/* ─── Upload pipeline ─────────────────────────────────────── */
uploadBtn.addEventListener('click', async () => {
  if (!selectedFiles.length) return;

  if (!complaintToken) {
    Toast.warning('Please link a complaint token first.');
    tokenPrompt.style.display = 'block';
    return;
  }

  if (!complaintId) {
    Toast.warning('No complaint ID found. Please file a complaint first.');
    return;
  }

  setLoading(uploadBtn, true);
  overallProgress.style.display = 'block';

  const total   = selectedFiles.length;
  let   done    = 0;
  const results = [];

  // ── Stage 1: Hash all files ─────────────────────────────
  setPipelineStep(2);
  setProgress(0, 'Computing SHA-256 hashes...');

  for (const item of selectedFiles) {
    item.status = 'hashing';
    updateFileItem(item);

    try {
      item.hash   = await sha256File(item.file);
      item.status = 'hashed';
    } catch {
      item.status = 'error';
      item.error  = 'Hash failed';
    }

    done++;
    setProgress((done / total) * 40, `Hashed ${done}/${total} files`);
    updateFileItem(item);
  }

  // ── Stage 2: Upload each to backend → IPFS ─────────────
  setPipelineStep(3);
  done = 0;

  for (const item of selectedFiles) {
    if (item.status === 'error') continue;

    item.status = 'uploading';
    updateFileItem(item);

    try {
      const fd = new FormData();
      fd.append('file',           item.file);       // multer field: 'file'
      fd.append('clientHash',     item.hash);        // FIX: was 'sha256Hash', backend expects 'clientHash'
      fd.append('complaintId',    complaintId);      // FIX: always send, not conditional
      fd.append('complaintToken', complaintToken);

      const result = await apiFetch(`${API.evidence}/upload`, {
        method: 'POST',
        body: fd,
      });

      item.ipfsCid = result.ipfsCid;
      item.txHash  = result.blockchainTx;
      item.dbId    = result.id;
      item.status  = 'done';

      results.push(item);

    } catch (err) {
      item.status = 'error';
      item.error  = err.message;
    }

    done++;
    setProgress(40 + (done / total) * 50, `Uploaded ${done}/${total} files`);
    updateFileItem(item);
  }

  // ── Stage 3: Blockchain stamp (done server-side, confirm) ─
  setPipelineStep(4);
  setProgress(100, 'All files secured on IPFS & blockchain!');

  const successCount = results.length;
  const failCount    = selectedFiles.filter(f => f.status === 'error').length;

  if (successCount > 0) {
    Toast.success(`${successCount} file${successCount > 1 ? 's' : ''} secured successfully!`);
    renderUploadedList(results);
    selectedFiles = selectedFiles.filter(f => f.status === 'error');
    renderFileList();
    updateUploadActions();
  }

  if (failCount > 0) {
    Toast.error(`${failCount} file${failCount > 1 ? 's' : ''} failed to upload.`);
  }

  setLoading(uploadBtn, false);

  setTimeout(() => {
    overallProgress.style.display = 'none';
    setProgress(0, '');
    setPipelineStep(1);
  }, 3000);
});

/* ─── Render uploaded evidence list ──────────────────────── */
function renderUploadedList(items) {
  uploadedCard.style.display = 'block';

  const all = uploadedList.querySelectorAll('.uploaded-item').length + items.length;
  uploadedCount.textContent = `${all} file${all > 1 ? 's' : ''}`;

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'uploaded-item';
    el.style.cssText = `
      padding: var(--space-4);
      border: 1px solid var(--clr-border);
      border-radius: var(--r-md);
      margin-bottom: var(--space-3);
      animation: fade-up 0.4s var(--ease-out) both;
    `;
    el.innerHTML = `
      <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-3);">
        <span style="font-size:1.2rem;">${fileIcon(item.file.type)}</span>
        <div style="flex:1; min-width:0;">
          <div style="font-size:var(--text-sm); font-weight:600; color:var(--clr-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${item.file.name}
          </div>
          <div style="font-size:var(--text-xs); color:var(--clr-text-3);">${formatFileSize(item.file.size)}</div>
        </div>
        <span class="badge badge--safe">✓ Secured</span>
      </div>

      <div style="display:flex; flex-direction:column; gap:var(--space-2);">
        <div>
          <div style="font-size:10px; color:var(--clr-text-3); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px;">SHA-256 Hash</div>
          <div class="hash-display">${item.hash}</div>
        </div>

        <div style="display:flex; gap:var(--space-2); flex-wrap:wrap;">
          ${item.ipfsCid ? `
            <a href="https://ipfs.io/ipfs/${item.ipfsCid}" target="_blank" rel="noopener"
               class="verify-badge verify-badge--ipfs">
              🌐 View on IPFS
            </a>
          ` : ''}
          ${item.txHash ? `
            <a href="https://mumbai.polygonscan.com/tx/${item.txHash}" target="_blank" rel="noopener"
               class="verify-badge verify-badge--chain">
              ⛓️ Blockchain proof
            </a>
          ` : `
            <span class="verify-badge verify-badge--pending">⛓️ Chain stamp pending</span>
          `}
        </div>
      </div>
    `;
    uploadedList.prepend(el);
  });
}

/* ─── Helper: update single file item in list ─────────────── */
function updateFileItem(item) {
  const el = document.getElementById(`file-item-${item.id}`);
  if (!el) return;

  const statusEl = el.querySelector('.file-item__status');
  if (statusEl) statusEl.innerHTML = statusBadge(item);

  if (item.hash) {
    let hashEl = el.querySelector('.file-item__hash');
    if (!hashEl) {
      hashEl = document.createElement('div');
      hashEl.className = 'file-item__hash';
      el.querySelector('.file-item__info').appendChild(hashEl);
    }
    hashEl.textContent = `SHA-256: ${truncateHash(item.hash, 12)}`;
  }
}

/* ─── Pipeline step indicator ─────────────────────────────── */
function setPipelineStep(activeStep) {
  [1, 2, 3, 4].forEach(n => {
    const el = document.getElementById(`pipe${n}`);
    if (!el) return;
    el.className = 'pipeline-step';
    if (n < activeStep)  el.classList.add('pipeline-step--done');
    if (n === activeStep) el.classList.add('pipeline-step--active');
  });
}

/* ─── Progress bar update ─────────────────────────────────── */
function setProgress(pct, label) {
  progressBar.style.width = `${Math.min(pct, 100)}%`;
  progressLabel.textContent = label;
  progressPct.textContent   = `${Math.round(pct)}%`;

  progressBar.classList.remove('progress__bar--safe', 'progress__bar--uploading');
  if (pct >= 100) {
    progressBar.classList.add('progress__bar--safe');
  } else {
    progressBar.classList.add('progress__bar--uploading');
  }
}