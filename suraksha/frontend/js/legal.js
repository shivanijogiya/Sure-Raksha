// ── Legal data ────────────────────────────────────────────────────────────────
// Each entry has: title, laws[], steps[], helplines[]
// laws[] entries used directly in the PDF report generator.

const LEGAL_DATA = {
  harassment: {
    title: 'Sexual Harassment',
    laws: [
      'Section 354 IPC — Assault or criminal force with intent to outrage modesty',
      'Section 354A IPC — Sexual harassment and punishment',
      'Section 354B IPC — Assault with intent to disrobe a woman',
      'POSH Act 2013 — Prevention of Sexual Harassment at Workplace',
      'Section 509 IPC — Word, gesture or act intended to insult the modesty of a woman',
    ],
    steps: [
      'Document the incident immediately — note date, time, location, and witnesses.',
      'Preserve any digital evidence (messages, screenshots) before they are deleted.',
      'File a complaint with the nearest police station. You can demand a woman officer.',
      'If workplace-related, file a complaint with your Internal Complaints Committee (ICC).',
      'You can also file a complaint with the National Commission for Women (NCW).',
      'Seek legal aid from the State Legal Services Authority (SLSA) if needed for free.',
    ],
    helplines: [
      { name: 'Women Helpline', number: '1091' },
      { name: 'National Commission for Women', number: '7827170170' },
      { name: 'Police Emergency', number: '112' },
    ],
  },
  stalking: {
    title: 'Stalking',
    laws: [
      'Section 354D IPC — Stalking (following, monitoring, contacting repeatedly against will)',
      'Section 507 IPC — Criminal intimidation by anonymous communication',
      'IT Act Section 66E — Violation of privacy',
      'IT Act Section 67 — Publishing obscene material',
    ],
    steps: [
      'Keep a log of every stalking incident with timestamps and screenshots.',
      'Block the individual on all platforms and change privacy settings.',
      'File an FIR under Section 354D IPC at the nearest police station.',
      'Apply for a restraining order through a magistrate court.',
      'Inform trusted contacts and ensure someone knows your daily schedule.',
    ],
    helplines: [
      { name: 'Women Helpline', number: '1091' },
      { name: 'Cyber Crime Helpline', number: '1930' },
      { name: 'Police Emergency', number: '112' },
    ],
  },
  assault: {
    title: 'Physical Assault',
    laws: [
      'Section 351 IPC — Assault',
      'Section 352 IPC — Punishment for assault',
      'Section 354 IPC — Assault to outrage modesty of woman',
      'Section 376 IPC — Rape (punishment up to life imprisonment)',
      'Section 326A IPC — Acid attack (punishment up to life imprisonment)',
    ],
    steps: [
      'Seek immediate medical attention. Ask for a medico-legal certificate (MLC).',
      'Do not wash clothes or bathe before the medical examination — preserve evidence.',
      'File an FIR immediately. Under POCSO and Rape laws, police MUST register the FIR.',
      'If police refuse, send a written complaint to the SP/DSP or file via e-FIR.',
      'Contact a legal aid lawyer through the State Legal Services Authority (SLSA).',
    ],
    helplines: [
      { name: 'Women Helpline', number: '1091' },
      { name: 'One Stop Centre (Sakhi)', number: '181' },
      { name: 'Police Emergency', number: '112' },
    ],
  },
  cybercrime: {
    title: 'Cybercrime / Online Abuse',
    laws: [
      'IT Act Section 66C — Identity theft',
      'IT Act Section 66D — Cheating by personation using computer',
      'IT Act Section 66E — Violation of privacy (capturing intimate images)',
      'IT Act Section 67 — Publishing obscene material electronically',
      'IT Act Section 67A — Publishing sexually explicit material',
      'Section 354C IPC — Voyeurism',
      'Section 354D IPC — Cyber stalking',
    ],
    steps: [
      'Take screenshots of all abusive content before reporting or blocking.',
      'Report the content to the platform (Facebook, Instagram, etc.).',
      'File a complaint at cybercrime.gov.in or call 1930.',
      'File an FIR at the nearest police station under IT Act sections.',
      'Request content removal directly from platforms using legal notices if needed.',
    ],
    helplines: [
      { name: 'Cyber Crime Helpline', number: '1930' },
      { name: 'cybercrime.gov.in', number: 'Online portal' },
      { name: 'Women Helpline', number: '1091' },
    ],
  },
  workplace: {
    title: 'Workplace Harassment',
    laws: [
      'POSH Act 2013 — Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal)',
      'Section 354A IPC — Sexual harassment',
      'Section 509 IPC — Words or gestures insulting modesty',
      'Industrial Disputes Act — If employer retaliates post-complaint',
    ],
    steps: [
      'File a written complaint with the Internal Complaints Committee (ICC) within 3 months.',
      'If no ICC exists (less than 10 employees), file with the Local Complaints Committee (LCC).',
      'Collect evidence: emails, messages, witness names.',
      'If employer does not act, escalate to the district officer under POSH Act.',
      'You can also file a criminal complaint under IPC sections alongside POSH.',
    ],
    helplines: [
      { name: 'SHe-Box (online POSH portal)', number: 'shebox.nic.in' },
      { name: 'National Commission for Women', number: '7827170170' },
      { name: 'Women Helpline', number: '1091' },
    ],
  },
  domestic: {
    title: 'Domestic Violence',
    laws: [
      'Protection of Women from Domestic Violence Act 2005 (PWDVA)',
      'Section 498A IPC — Cruelty by husband or his relatives',
      'Section 304B IPC — Dowry death',
      'Section 406 IPC — Criminal breach of trust (for withheld streedhan)',
      'Hindu Marriage Act / Special Marriage Act — Grounds for divorce',
    ],
    steps: [
      'Contact a Protection Officer (PO) — they are appointed in every district under PWDVA.',
      'Apply for a Protection Order through the magistrate court.',
      'You can seek shelter at a government-recognized shelter home.',
      'File an FIR under Section 498A IPC for cruelty.',
      'Apply for interim maintenance under PWDVA while the case is pending.',
    ],
    helplines: [
      { name: 'One Stop Centre (Sakhi)', number: '181' },
      { name: 'Women Helpline', number: '1091' },
      { name: 'iCall (mental health support)', number: '9152987821' },
    ],
  },
};

// ── UI functions ───────────────────────────────────────────────────────────────

function showLaws() {
  const type = document.getElementById('incidentType').value;
  const section = document.getElementById('lawsSection');

  if (!type) {
    section.classList.add('hidden');
    return;
  }

  const data = LEGAL_DATA[type];
  if (!data) return;

  document.getElementById('lawsTitle').textContent = data.title;

  // Laws list
  const lawsList = document.getElementById('lawsList');
  lawsList.innerHTML = data.laws
    .map(l => `<div class="law-item">📌 ${l}</div>`)
    .join('');

  // Steps
  const stepsList = document.getElementById('stepsList');
  stepsList.innerHTML = data.steps
    .map(s => `<li>${s}</li>`)
    .join('');

  // Helplines
  const helplinesList = document.getElementById('helplinesList');
  helplinesList.innerHTML = data.helplines
    .map(h => `<div class="helpline-item"><strong>${h.name}</strong> — ${h.number}</div>`)
    .join('');

  section.classList.remove('hidden');
}

// Store selected laws in localStorage so report.js and report-gen.js can use them
function useInReport() {
  const type = document.getElementById('incidentType').value;
  if (!type || !LEGAL_DATA[type]) return;

  const laws = LEGAL_DATA[type].laws;
  localStorage.setItem('suraksha_selected_laws', JSON.stringify(laws));
  localStorage.setItem('suraksha_selected_category', type);

  alert('Laws saved. Go to Report page to include them in your complaint.');
  window.location.href = 'report.html';
}

function downloadGuidance() {
  const type = document.getElementById('incidentType').value;
  if (!type) return alert('Please select an incident type first.');

  // Trigger PDF report generation with just the legal guide (no complaint needed)
  const data = LEGAL_DATA[type];
  const content = [
    `SURAKSHA — Legal Guidance: ${data.title}`,
    '',
    'APPLICABLE LAWS:',
    ...data.laws.map(l => `• ${l}`),
    '',
    'RECOMMENDED STEPS:',
    ...data.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    'HELPLINES:',
    ...data.helplines.map(h => `${h.name}: ${h.number}`),
    '',
    `Generated by Suraksha on ${new Date().toLocaleString('en-IN')}`,
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `suraksha-legal-guide-${type}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}