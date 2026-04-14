/**
 * legal-chatbot.js — Suraksha Legal Assistant (Aariva variant)
 * Floating chatbot for legal.html
 * Uses Groq API (llama-3.3-70b-versatile) for legal guidance
 *
 * Usage:
 *   1. Add your Groq API key to GROQ_API_KEY below
 *      (or set window.GROQ_API_KEY before this script loads)
 *   2. Drop one line in legal.html before </body>:
 *      <script src="js/legal-chatbot.js"></script>
 *
 * ⚠️  For production: move the API call to your backend (/api/chat)
 *     so the key is never exposed in the browser.
 */

(function () {
  'use strict';

  /* ─── CONFIG ──────────────────────────────────────────────────────────── */
  const GROQ_API_KEY  = window.GROQ_API_KEY || 'YOUR_GROQ_API_KEY_HERE';
  const GROQ_MODEL    = 'llama-3.3-70b-versatile';
  const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
  const MAX_HISTORY   = 20;   // messages kept in context
  const BOT_NAME      = 'Nyaya';   // "Justice" in Sanskrit
  const BOT_EMOJI     = '⚖️';

  /* System prompt — defines the bot's legal persona */
  const SYSTEM_PROMPT = `You are Nyaya, a compassionate and knowledgeable legal assistant inside Suraksha — a women's safety platform built for India.

Your role is to help survivors understand their legal rights in simple, clear language. You are NOT a lawyer and should always remind users to consult a legal professional for their specific situation.

You help with:
1. **Indian laws on harassment & violence** — BNS (Bharatiya Nyaya Sanhita, replacing IPC), POCSO, Protection of Women from Domestic Violence Act, Sexual Harassment of Women at Workplace Act (POSH), IPC sections still relevant (354, 375, 376, 498A, 509).
2. **Filing an FIR** — what it is, how to file, what to do if police refuse (Zero FIR, Section 173 CrPC / BNSS), complaint to SP/DCP, NCW online complaint.
3. **Survivor legal rights** — right to free legal aid (NALSA), right to medical examination (Section 357C CrPC / 397 BNSS), right to not be arrested at night (for women), right to anonymity, right to in-camera trial.
4. **Emergency helplines & NGOs** — Women Helpline 181, Police 100, Vandrevala Foundation 1860-2662-345, iCall 9152987821, NCW helpline 7827-170-170, Majlis, Sakhi, Snehi, Jagori.

Tone: warm, non-judgmental, simple English (not legalese). Use short paragraphs. Use bullet points when listing rights or steps. Always end sensitive answers with a helpline reminder.

If someone seems to be in immediate danger, prioritise: call 112 (emergency), Women Helpline 181.

Do NOT: give case-specific legal advice, diagnose mental health conditions, or share any personally identifying information.`;

  /* Quick-start suggestion chips */
  const SUGGESTIONS = [
    'What is sexual harassment under Indian law?',
    'How do I file an FIR?',
    'What if police refuse to take my complaint?',
    'What is the POSH Act?',
    'What legal rights do I have as a survivor?',
    'Which NGOs can help me?',
  ];

  /* ─── STATE ───────────────────────────────────────────────────────────── */
  let isOpen      = false;
  let isTyping    = false;
  let currentView = 'home'; // 'home' | 'chat'
  let history     = [];     // [{role, content}, ...]

  /* ─── STYLES ──────────────────────────────────────────────────────────── */
  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

    /* FAB */
    #suraksha-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 58px; height: 58px; border-radius: 50%;
      background: linear-gradient(135deg,#1a1b23,#2a1f3d);
      border: 1.5px solid #3d2f5e;
      cursor: pointer;
      box-shadow: 0 4px 24px rgba(90,50,140,0.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      outline: none;
    }
    #suraksha-fab:hover {
      transform: scale(1.07);
      box-shadow: 0 6px 32px rgba(130,80,200,0.5);
    }
    #suraksha-fab .fab-badge {
      position: absolute; top: 2px; right: 2px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #a855f7; border: 2px solid #0e0f14; display: none;
    }
    #suraksha-fab.has-unread .fab-badge { display: block; }
    #suraksha-fab .fab-emoji { font-size: 22px; line-height: 1; }

    /* Main window */
    #suraksha-window {
      position: fixed; bottom: 98px; right: 28px; z-index: 9998;
      width: 384px; height: 590px;
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 12px 60px rgba(0,0,0,0.22);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: 'DM Sans','Segoe UI',sans-serif;
      transform-origin: bottom right;
      transition: transform 0.24s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s;
    }
    #suraksha-window.hidden {
      transform: scale(0.86); opacity: 0; pointer-events: none;
    }

    /* ── HOME ── */
    .sl-home { display: flex; flex-direction: column; height: 100%; }

    .sl-home-hero {
      background: linear-gradient(140deg,#1a0a2e 0%,#2d1457 60%,#1e1040 100%);
      padding: 26px 22px 28px; flex-shrink: 0; position: relative; overflow: hidden;
    }
    .sl-home-hero::before {
      content:''; position:absolute; top:-50px; right:-50px;
      width:200px; height:200px; border-radius:50%;
      background: radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%);
    }
    .sl-home-close {
      position:absolute; top:14px; right:14px;
      background:rgba(255,255,255,0.1); border:none;
      color:rgba(255,255,255,0.6); width:28px; height:28px;
      border-radius:50%; cursor:pointer; font-size:17px;
      display:flex; align-items:center; justify-content:center;
      transition:background 0.15s;
    }
    .sl-home-close:hover { background:rgba(255,255,255,0.18); color:#fff; }

    .sl-home-logo {
      display:flex; align-items:center; gap:10px; margin-bottom:18px;
    }
    .sl-home-logo-icon {
      width:38px; height:38px;
      background:rgba(168,85,247,0.15);
      border:1px solid rgba(168,85,247,0.3);
      border-radius:10px;
      display:flex; align-items:center; justify-content:center; font-size:18px;
    }
    .sl-home-logo-name { font-size:17px; font-weight:700; color:#fff; letter-spacing:-0.2px; }

    .sl-home-headline { font-size:22px; font-weight:700; color:#fff; line-height:1.3; letter-spacing:-0.3px; }
    .sl-home-sub { font-size:13px; color:rgba(255,255,255,0.6); margin-top:6px; line-height:1.5; }

    /* Home body */
    .sl-home-body {
      flex:1; padding:14px; overflow-y:auto; background:#f5f3ff;
    }
    .sl-home-body::-webkit-scrollbar { width:4px; }
    .sl-home-body::-webkit-scrollbar-thumb { background:#c4b5fd; border-radius:4px; }

    .sl-card {
      background:#fff; border-radius:12px; margin-bottom:10px;
      border:1px solid #ede9fe; overflow:hidden;
      transition:box-shadow 0.15s;
    }
    .sl-card:hover { box-shadow:0 2px 12px rgba(109,40,217,0.1); }

    .sl-card-row {
      display:flex; align-items:center; justify-content:space-between;
      padding:13px 16px; cursor:pointer; border-bottom:1px solid #f5f3ff;
      transition:background 0.12s; text-decoration:none;
    }
    .sl-card-row:last-child { border-bottom:none; }
    .sl-card-row:hover { background:#faf7ff; }
    .sl-card-row-text { font-size:13.5px; font-weight:500; color:#1e1b4b; }
    .sl-card-row-icon { color:#7c3aed; font-size:16px; flex-shrink:0; }

    .sl-cta {
      background:#fff; border-radius:12px; margin-bottom:10px;
      border:1px solid #ede9fe; padding:14px 16px;
      display:flex; align-items:center; justify-content:space-between;
      cursor:pointer; transition:box-shadow 0.15s;
    }
    .sl-cta:hover { box-shadow:0 2px 12px rgba(109,40,217,0.12); }
    .sl-cta-text { font-size:14px; font-weight:600; color:#1e1b4b; }
    .sl-cta-btn {
      width:32px; height:32px; border-radius:50%;
      background:linear-gradient(135deg,#7c3aed,#a855f7);
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }

    .sl-alert {
      background:#fff8f1; border:1px solid #fed7aa; border-radius:12px;
      padding:13px 16px; margin-bottom:10px; cursor:pointer;
    }
    .sl-alert-title { font-size:13px; font-weight:600; color:#92400e; margin-bottom:3px; }
    .sl-alert-text  { font-size:12.5px; color:#b45309; line-height:1.5; }

    /* Bottom nav */
    .sl-bottom-nav {
      background:#fff; border-top:1px solid #ede9fe;
      display:flex; align-items:center; padding:6px 0 10px; flex-shrink:0;
    }
    .sl-nav-btn {
      flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;
      background:none; border:none; cursor:pointer; padding:6px 4px;
    }
    .sl-nav-btn .nl { font-size:11px; font-family:'DM Sans',sans-serif; font-weight:500; color:#9ca3af; }
    .sl-nav-btn.active .nl { color:#7c3aed; }

    /* ── CHAT ── */
    .sl-chat { display:flex; flex-direction:column; height:100%; background:#f5f3ff; }

    .sl-chat-header {
      background:linear-gradient(135deg,#1a0a2e,#2d1457);
      padding:13px 15px; display:flex; align-items:center; gap:10px; flex-shrink:0;
    }
    .sl-back {
      background:rgba(255,255,255,0.1); border:none; color:rgba(255,255,255,0.75);
      width:30px; height:30px; border-radius:50%; cursor:pointer;
      display:flex; align-items:center; justify-content:center; font-size:17px;
      transition:background 0.15s;
    }
    .sl-back:hover { background:rgba(255,255,255,0.18); color:#fff; }

    .sl-chat-avatar {
      width:36px; height:36px; border-radius:50%;
      background:rgba(168,85,247,0.18); border:1px solid rgba(168,85,247,0.4);
      display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0;
    }
    .sl-chat-info { flex:1; }
    .sl-chat-name { font-size:13.5px; font-weight:600; color:#fff; }
    .sl-chat-status {
      font-size:11px; color:#c4b5fd; display:flex; align-items:center; gap:5px; margin-top:2px;
    }
    .sl-chat-status::before {
      content:''; width:6px; height:6px; border-radius:50%; background:#22c55e;
      display:inline-block; animation:slPulse 2s infinite;
    }
    @keyframes slPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

    .sl-close-x {
      background:none; border:none; color:rgba(255,255,255,0.5);
      cursor:pointer; font-size:20px; padding:4px; border-radius:6px;
      display:flex; align-items:center; transition:color 0.15s;
    }
    .sl-close-x:hover { color:#fff; }

    /* Messages */
    .sl-messages {
      flex:1; overflow-y:auto; padding:14px 13px;
      display:flex; flex-direction:column; gap:8px; scroll-behavior:smooth;
    }
    .sl-messages::-webkit-scrollbar { width:4px; }
    .sl-messages::-webkit-scrollbar-thumb { background:#c4b5fd; border-radius:4px; }

    .sl-date { text-align:center; font-size:11px; color:#9ca3af; margin:3px 0 5px; }

    .sl-bubble {
      max-width:82%; padding:10px 14px; border-radius:14px;
      font-size:13.5px; line-height:1.6; word-break:break-word;
      animation:slIn 0.17s ease;
    }
    @keyframes slIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

    .sl-bubble.user {
      background:linear-gradient(135deg,#5b21b6,#7c3aed);
      color:#fff; align-self:flex-end; border-bottom-right-radius:4px;
    }
    .sl-bubble.bot {
      background:#fff; color:#1e1b4b; border:1px solid #ede9fe;
      align-self:flex-start; border-bottom-left-radius:4px;
      box-shadow:0 1px 4px rgba(109,40,217,0.07);
    }
    .sl-bubble.error {
      background:#fef2f2; color:#dc2626; border:1px solid #fee2e2;
      align-self:flex-start; font-size:13px;
    }
    .sl-bubble ul { margin:6px 0 0 16px; padding:0; }
    .sl-bubble li { margin-bottom:4px; }
    .sl-bubble strong { font-weight:600; }

    /* Typing */
    .sl-typing {
      display:flex; align-items:center; gap:5px; padding:11px 14px;
      background:#fff; border:1px solid #ede9fe; border-radius:14px;
      border-bottom-left-radius:4px; align-self:flex-start;
      box-shadow:0 1px 4px rgba(109,40,217,0.07);
      animation:slIn 0.17s ease;
    }
    .sl-typing span {
      width:6px; height:6px; background:#a78bfa; border-radius:50%;
      animation:slBounce 1.2s infinite;
    }
    .sl-typing span:nth-child(2) { animation-delay:0.2s; }
    .sl-typing span:nth-child(3) { animation-delay:0.4s; }
    @keyframes slBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

    /* Chips */
    .sl-chips { display:flex; flex-wrap:wrap; gap:6px; padding:0 13px 10px; }
    .sl-chip {
      font-size:11.5px; padding:5px 11px; border-radius:20px;
      border:1.5px solid #ddd6fe; background:#fff; color:#5b21b6;
      cursor:pointer; font-family:'DM Sans',sans-serif;
      transition:border-color 0.15s,background 0.15s;
    }
    .sl-chip:hover { border-color:#7c3aed; background:#faf7ff; }

    /* Footer */
    .sl-footer {
      border-top:1px solid #ede9fe; padding:10px 12px;
      display:flex; align-items:flex-end; gap:8px;
      background:#fff; flex-shrink:0;
    }
    .sl-input {
      flex:1; border:1.5px solid #ddd6fe; border-radius:10px;
      padding:9px 13px; font-size:13.5px; outline:none;
      background:#faf7ff; color:#1e1b4b;
      font-family:'DM Sans',sans-serif;
      transition:border-color 0.2s,box-shadow 0.2s;
      resize:none; line-height:1.45; max-height:80px; overflow-y:auto;
    }
    .sl-input:focus { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.12); background:#fff; }
    .sl-input::placeholder { color:#a78bfa; }
    .sl-send {
      width:36px; height:36px; border-radius:10px;
      background:linear-gradient(135deg,#5b21b6,#7c3aed);
      border:none; cursor:pointer;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
      transition:opacity 0.15s,transform 0.15s;
    }
    .sl-send:hover { opacity:0.9; transform:scale(1.05); }
    .sl-send:disabled { opacity:0.35; cursor:not-allowed; transform:none; }

    /* Disclaimer banner */
    .sl-disclaimer {
      font-size:11px; color:#7c3aed; background:#faf7ff;
      border-top:1px solid #ede9fe; padding:6px 14px; text-align:center; flex-shrink:0;
    }

    /* Help tab */
    .sl-help { flex:1; overflow-y:auto; padding:16px; background:#f5f3ff; }
    .sl-help-title { font-size:15px; font-weight:700; color:#1e1b4b; margin-bottom:12px; }
    .sl-help-item {
      background:#fff; border-radius:10px; padding:12px 14px;
      margin-bottom:8px; border:1px solid #ede9fe; cursor:pointer;
      transition:box-shadow 0.12s;
    }
    .sl-help-item:hover { box-shadow:0 2px 10px rgba(109,40,217,0.1); }
    .sl-help-item-title { font-size:13.5px; font-weight:600; color:#1e1b4b; }
    .sl-help-item-sub  { font-size:12px; color:#7c3aed; margin-top:2px; }

    /* Emergency banner */
    .sl-emergency {
      background:#7f1d1d; color:#fee2e2; font-size:12px;
      padding:7px 14px; text-align:center; font-weight:500; flex-shrink:0;
    }

    /* Msgs empty */
    .sl-msgs-empty {
      flex:1; display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:10px; background:#f5f3ff; padding:24px;
    }
    .sl-msgs-empty-icon { font-size:36px; opacity:0.4; }
    .sl-msgs-empty-text { font-size:14px; color:#9ca3af; text-align:center; }
    .sl-msgs-empty-btn {
      margin-top:8px; padding:9px 20px; background:linear-gradient(135deg,#5b21b6,#7c3aed);
      color:#fff; border:none; border-radius:8px;
      font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif;
      cursor:pointer; transition:opacity 0.15s;
    }
    .sl-msgs-empty-btn:hover { opacity:0.9; }

    @media (max-width:440px) {
      #suraksha-window { width:calc(100vw - 18px); right:9px; height:92vh; bottom:78px; }
    }
  `;

  /* ─── INJECT STYLES ────────────────────────────────────────────────────── */
  function injectStyles() {
    const el = document.createElement('style');
    el.textContent = STYLES;
    document.head.appendChild(el);
  }

  /* ─── BUILD WIDGET ─────────────────────────────────────────────────────── */
  function buildWidget() {
    // FAB
    const fab = document.createElement('button');
    fab.id = 'suraksha-fab';
    fab.setAttribute('aria-label', 'Open Nyaya legal assistant');
    fab.innerHTML = `
      <span class="fab-badge"></span>
      <span class="fab-emoji">${BOT_EMOJI}</span>`;
    fab.addEventListener('click', toggleWidget);

    // Window
    const win = document.createElement('div');
    win.id = 'suraksha-window';
    win.classList.add('hidden');

    document.body.appendChild(fab);
    document.body.appendChild(win);
    renderHomeScreen(win);
  }

  /* ─── HOME SCREEN ──────────────────────────────────────────────────────── */
  function renderHomeScreen(win) {
    win.innerHTML = `
      <div class="sl-home">
        <div class="sl-home-hero">
          <button class="sl-home-close" id="sl-close-home" aria-label="Close">×</button>
          <div class="sl-home-logo">
            <div class="sl-home-logo-icon">${BOT_EMOJI}</div>
            <span class="sl-home-logo-name">Nyaya · Legal Assistant</span>
          </div>
          <div class="sl-home-headline">Know your rights.<br>You are not alone.</div>
          <div class="sl-home-sub">Free, anonymous legal guidance for survivors.</div>
        </div>

        <div class="sl-home-body" id="sl-tab-content">
          ${homeTabHTML()}
        </div>

        <div class="sl-bottom-nav">
          <button class="sl-nav-btn active" id="sl-nav-home">
            <span style="font-size:20px">🏠</span>
            <span class="nl">Home</span>
          </button>
          <button class="sl-nav-btn" id="sl-nav-msgs">
            <span style="font-size:20px">💬</span>
            <span class="nl">Messages</span>
          </button>
          <button class="sl-nav-btn" id="sl-nav-help">
            <span style="font-size:20px">📚</span>
            <span class="nl">Legal Info</span>
          </button>
        </div>
      </div>`;

    bindHomeEvents(win);
  }

  function homeTabHTML() {
    return `
      <div class="sl-card">
        <div class="sl-card-row" id="sl-chat-cta">
          <span class="sl-card-row-text">Chat with ${BOT_NAME}</span>
          <span class="sl-card-row-icon">→</span>
        </div>
        <div class="sl-card-row" onclick="window.location.href='track.html'">
          <span class="sl-card-row-text">Track my complaint</span>
          <span class="sl-card-row-icon">→</span>
        </div>
      </div>

      <div class="sl-cta" id="sl-msg-cta">
        <span class="sl-cta-text">Ask a legal question</span>
        <div class="sl-cta-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2.2" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>

      <div class="sl-alert" id="sl-emergency-card">
        <div class="sl-alert-title">🚨 In immediate danger?</div>
        <div class="sl-alert-text">Call <strong>112</strong> (Emergency) or <strong>181</strong> (Women Helpline) right now. Your safety comes first.</div>
      </div>

      <div class="sl-card">
        <div class="sl-card-row" id="sl-ipc-link">
          <span class="sl-card-row-text">Harassment laws (BNS/IPC)</span>
          <span class="sl-card-row-icon">→</span>
        </div>
        <div class="sl-card-row" id="sl-fir-link">
          <span class="sl-card-row-text">How to file an FIR</span>
          <span class="sl-card-row-icon">→</span>
        </div>
        <div class="sl-card-row" id="sl-posh-link">
          <span class="sl-card-row-text">Workplace harassment (POSH)</span>
          <span class="sl-card-row-icon">→</span>
        </div>
        <div class="sl-card-row" id="sl-ngo-link">
          <span class="sl-card-row-text">NGOs & helplines</span>
          <span class="sl-card-row-icon">→</span>
        </div>
      </div>`;
  }

  function bindHomeEvents(win) {
    win.querySelector('#sl-close-home').addEventListener('click', closeWidget);
    win.querySelector('#sl-chat-cta').addEventListener('click', () => switchToChat(win));
    win.querySelector('#sl-msg-cta').addEventListener('click', () => switchToChat(win));

    /* Quick-fire topic links */
    const topicMap = {
      '#sl-ipc-link':  'What are the key Indian laws on harassment and sexual violence? Include BNS sections.',
      '#sl-fir-link':  'How do I file an FIR for harassment or assault in India? What are my rights during the process?',
      '#sl-posh-link': 'Explain the POSH Act and how it protects women from workplace sexual harassment.',
      '#sl-ngo-link':  'List NGOs and helplines that help women survivors of harassment or violence in India.',
    };
    Object.entries(topicMap).forEach(([sel, query]) => {
      win.querySelector(sel)?.addEventListener('click', () => {
        switchToChat(win);
        setTimeout(() => submitText(query), 200);
      });
    });

    /* Nav tabs */
    win.querySelector('#sl-nav-home').addEventListener('click', () => {
      setActiveNav(win, 'home');
      win.querySelector('#sl-tab-content').innerHTML = homeTabHTML();
      bindHomeTabEvents(win);
    });
    win.querySelector('#sl-nav-msgs').addEventListener('click', () => {
      setActiveNav(win, 'msgs');
      renderMsgsTab(win);
    });
    win.querySelector('#sl-nav-help').addEventListener('click', () => {
      setActiveNav(win, 'help');
      renderHelpTab(win);
    });
  }

  function bindHomeTabEvents(win) {
    win.querySelector('#sl-chat-cta')?.addEventListener('click', () => switchToChat(win));
    win.querySelector('#sl-msg-cta')?.addEventListener('click', () => switchToChat(win));
    const topicMap = {
      '#sl-ipc-link':  'What are the key Indian laws on harassment and sexual violence? Include BNS sections.',
      '#sl-fir-link':  'How do I file an FIR for harassment or assault in India?',
      '#sl-posh-link': 'Explain the POSH Act and workplace sexual harassment rights.',
      '#sl-ngo-link':  'List NGOs and helplines for women survivors in India.',
    };
    Object.entries(topicMap).forEach(([sel, query]) => {
      win.querySelector(sel)?.addEventListener('click', () => {
        switchToChat(win);
        setTimeout(() => submitText(query), 200);
      });
    });
  }

  function setActiveNav(win, tab) {
    win.querySelectorAll('.sl-nav-btn').forEach(b => b.classList.remove('active'));
    const map = { home:'#sl-nav-home', msgs:'#sl-nav-msgs', help:'#sl-nav-help' };
    win.querySelector(map[tab])?.classList.add('active');
  }

  function renderMsgsTab(win) {
    const body = win.querySelector('#sl-tab-content');
    if (!body) return;
    if (history.length > 0) {
      const last = history[history.length - 1];
      body.innerHTML = `
        <div class="sl-card" id="sl-resume" style="cursor:pointer;margin-top:4px;">
          <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;">
            <div style="width:38px;height:38px;border-radius:50%;background:#f5f3ff;border:1px solid #ddd6fe;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${BOT_EMOJI}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13.5px;font-weight:600;color:#1e1b4b;">${BOT_NAME} · Nyaya</div>
              <div style="font-size:12.5px;color:#7c3aed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${last.content.slice(0, 70)}…</div>
            </div>
            <span style="color:#a78bfa;font-size:16px;">›</span>
          </div>
        </div>`;
      body.querySelector('#sl-resume').addEventListener('click', () => switchToChat(win));
    } else {
      body.innerHTML = `
        <div class="sl-msgs-empty">
          <div class="sl-msgs-empty-icon">💬</div>
          <div class="sl-msgs-empty-text">No conversations yet.<br>Ask ${BOT_NAME} a legal question!</div>
          <button class="sl-msgs-empty-btn" id="sl-start-btn">Start a conversation</button>
        </div>`;
      body.querySelector('#sl-start-btn').addEventListener('click', () => switchToChat(win));
    }
  }

  function renderHelpTab(win) {
    const body = win.querySelector('#sl-tab-content');
    if (!body) return;
    const articles = [
      { title:'What is the BNS / new IPC?', sub:'Bharatiya Nyaya Sanhita, 2023 — replacing IPC', q:'Explain the Bharatiya Nyaya Sanhita (BNS) and how it replaces the IPC for harassment cases.' },
      { title:'What is Section 354 (now BNS 74)?', sub:'Assault or criminal force on a woman', q:'What is Section 354 IPC (now BNS Section 74) about assault on women?' },
      { title:'What is sexual harassment under law?', sub:'POSH Act + IPC 354A / BNS 75', q:'What constitutes sexual harassment under the POSH Act and BNS Section 75?' },
      { title:'What is domestic violence?', sub:'Protection of Women from Domestic Violence Act', q:'What counts as domestic violence under the PWDVA? What protection orders are available?' },
      { title:'Right to free legal aid', sub:'NALSA — anyone can apply', q:'How do I get free legal aid from NALSA as a survivor?' },
      { title:'Can police refuse my FIR?', sub:'Zero FIR and Section 173 BNSS', q:'What do I do if police refuse to file my FIR? What is a Zero FIR?' },
    ];
    body.innerHTML = `
      <div class="sl-help">
        <div class="sl-help-title">Legal quick guides</div>
        ${articles.map(a => `
          <div class="sl-help-item" data-q="${encodeURIComponent(a.q)}">
            <div class="sl-help-item-title">${a.title}</div>
            <div class="sl-help-item-sub">${a.sub}</div>
          </div>`).join('')}
      </div>`;
    body.querySelectorAll('.sl-help-item').forEach(el => {
      el.addEventListener('click', () => {
        const q = decodeURIComponent(el.dataset.q);
        switchToChat(win);
        setTimeout(() => submitText(q), 200);
      });
    });
  }

  /* ─── CHAT SCREEN ──────────────────────────────────────────────────────── */
  function switchToChat(win) {
    currentView = 'chat';
    win.innerHTML = `
      <div class="sl-chat">
        <div class="sl-chat-header">
          <button class="sl-back" id="sl-back" aria-label="Back">‹</button>
          <div class="sl-chat-avatar">${BOT_EMOJI}</div>
          <div class="sl-chat-info">
            <div class="sl-chat-name">${BOT_NAME}</div>
            <div class="sl-chat-status">Online · Legal Assistant</div>
          </div>
          <button class="sl-close-x" id="sl-close-chat" aria-label="Close">×</button>
        </div>

        <div class="sl-emergency">
          🚨 Immediate danger? Call <strong>112</strong> or Women Helpline <strong>181</strong>
        </div>

        <div class="sl-messages" id="sl-messages">
          <div class="sl-date">Today</div>
        </div>

        <div class="sl-chips" id="sl-chips"></div>

        <div class="sl-footer">
          <textarea id="sl-input" class="sl-input" placeholder="Ask me your legal question…"
            rows="1" maxlength="600" aria-label="Legal question"></textarea>
          <button id="sl-send" class="sl-send" aria-label="Send">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2.2" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <div class="sl-disclaimer">
          ⚠️ Not legal advice · Always consult a qualified lawyer for your specific case
        </div>
      </div>`;

    win.querySelector('#sl-back').addEventListener('click', () => {
      currentView = 'home';
      renderHomeScreen(win);
    });
    win.querySelector('#sl-close-chat').addEventListener('click', closeWidget);
    win.querySelector('#sl-send').addEventListener('click', sendMessage);
    win.querySelector('#sl-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    win.querySelector('#sl-input').addEventListener('input', () => {
      const ta = win.querySelector('#sl-input');
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
    });

    const msgBox = win.querySelector('#sl-messages');
    if (history.length > 0) {
      history.forEach(m => appendBubble(m.role === 'user' ? 'user' : 'bot', m.content));
    } else {
      showWelcome();
    }
    win.querySelector('#sl-input').focus();
  }

  /* ─── WELCOME ──────────────────────────────────────────────────────────── */
  function showWelcome() {
    appendBubble('bot',
      `Namaste! I'm **${BOT_NAME}**, your legal guide on Suraksha.\n\nI can help you understand your rights, the laws that protect you, and what steps you can take. What would you like to know?`
    );
    renderChips();
  }

  function renderChips() {
    const container = document.getElementById('sl-chips');
    if (!container) return;
    container.innerHTML = '';
    SUGGESTIONS.forEach(text => {
      const btn = document.createElement('button');
      btn.className = 'sl-chip';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        container.innerHTML = '';
        submitText(text);
      });
      container.appendChild(btn);
    });
  }

  /* ─── BUBBLE RENDERING ─────────────────────────────────────────────────── */
  function appendBubble(role, raw) {
    const box = document.getElementById('sl-messages');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `sl-bubble ${role}`;

    /* Simple markdown: **bold**, *italic*, bullet lists, line breaks */
    let html = raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    /* Convert leading "- " or "• " lines into <ul><li> */
    const lines = html.split('\n');
    let out = '', inList = false;
    lines.forEach(line => {
      if (/^[-•]\s/.test(line)) {
        if (!inList) { out += '<ul>'; inList = true; }
        out += `<li>${line.replace(/^[-•]\s/, '')}</li>`;
      } else {
        if (inList) { out += '</ul>'; inList = false; }
        out += line + (line ? '<br>' : '');
      }
    });
    if (inList) out += '</ul>';
    el.innerHTML = out;

    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function showTyping() {
    const box = document.getElementById('sl-messages');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'sl-typing';
    el.id = 'sl-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  function hideTyping() { document.getElementById('sl-typing')?.remove(); }

  /* ─── SEND MESSAGE ─────────────────────────────────────────────────────── */
  function sendMessage() {
    const input = document.getElementById('sl-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || isTyping) return;
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('sl-chips').innerHTML = '';
    submitText(text);
  }

  async function submitText(text) {
    appendBubble('user', text);
    history.push({ role: 'user', content: text });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

    isTyping = true;
    const sendBtn = document.getElementById('sl-send');
    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
      ];

      const res = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          max_tokens: 800,
          temperature: 0.4,
          top_p: 0.9,
        }),
      });

      hideTyping();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const data  = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "I'm sorry, I didn't receive a response. Please try again.";

      appendBubble('bot', reply);
      history.push({ role: 'assistant', content: reply });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

      if (!isOpen) {
        document.getElementById('suraksha-fab')?.classList.add('has-unread');
      }

    } catch (err) {
      hideTyping();
      const box = document.getElementById('sl-messages');
      if (box) {
        const errEl = document.createElement('div');
        errEl.className = 'sl-bubble error';
        errEl.textContent = `⚠️ ${err.message || 'Could not reach the assistant. Please check your connection.'}`;
        box.appendChild(errEl);
        box.scrollTop = box.scrollHeight;
      }
    } finally {
      isTyping = false;
      if (sendBtn) sendBtn.disabled = false;
      document.getElementById('sl-input')?.focus();
    }
  }

  /* ─── TOGGLE / OPEN / CLOSE ────────────────────────────────────────────── */
  function toggleWidget() { isOpen ? closeWidget() : openWidget(); }

  function openWidget() {
    isOpen = true;
    document.getElementById('suraksha-fab')?.classList.remove('has-unread');
    document.getElementById('suraksha-window')?.classList.remove('hidden');
    if (currentView === 'chat') document.getElementById('sl-input')?.focus();
  }

  function closeWidget() {
    isOpen = false;
    document.getElementById('suraksha-window')?.classList.add('hidden');
  }

  /* ─── INIT ─────────────────────────────────────────────────────────────── */
  function init() {
    injectStyles();
    buildWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();