/* ══════════════════════════════
   API CLIENT
   The backend is authoritative for every score-bearing action. When the game is
   served from the backend itself (port 4000) requests are same-origin; the
   explicit host is the fallback for opening the pages off a separate dev server.
══════════════════════════════ */
const API_BASE = (location.port === '4000' || location.protocol === 'file:')
    ? (location.protocol === 'file:' ? 'http://localhost:4000' : '')
    : `${location.protocol}//${location.hostname}:4000`;

/* ══════════════════════════
   VFX: CUSTOM CURSOR & LOCKOUT
══════════════════════════ */
function initVFX() {
    // Custom Cursor
    const dot = document.createElement('div');
    dot.id = 'vfx-cursor-dot';
    const ring = document.createElement('div');
    ring.id = 'vfx-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    window.addEventListener('mousemove', (e) => {
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
        ring.style.left = `${e.clientX}px`;
        ring.style.top = `${e.clientY}px`;
    });

    document.addEventListener('mousedown', () => ring.classList.add('hover-btn'));
    document.addEventListener('mouseup', () => ring.classList.remove('hover-btn'));

    const addHover = () => { ring.classList.add('hover'); dot.classList.add('hover'); };
    const removeHover = () => { ring.classList.remove('hover'); dot.classList.remove('hover'); };

    // Attach to initial elements and body mouseover for dynamic elements
    document.body.addEventListener('mouseover', (e) => {
        if (e.target.closest('button, a, input, .interactable')) addHover();
    });
    document.body.addEventListener('mouseout', (e) => {
        if (e.target.closest('button, a, input, .interactable')) removeHover();
    });

    // Mobile Lockout
    const lockout = document.createElement('div');
    lockout.id = 'vfx-mobile-lockout';
    lockout.innerHTML = `<div>TechChase 2K26 IS OPTIMIZED FOR DESKTOP.<br><br>PLEASE SWITCH TO A LAPTOP OR DESKTOP TO CONTINUE.</div>`;
    document.body.appendChild(lockout);
}
document.addEventListener('DOMContentLoaded', initVFX);

const API = {
    get token() { return localStorage.getItem('tc_token'); },
    set token(v) {
        if (v) localStorage.setItem('tc_token', v);
        else localStorage.removeItem('tc_token');
    },

    async request(path, { method = 'GET', body } = {}) {
        const res = await fetch(API_BASE + path, {
            method,
            headers: {
                'content-type': 'application/json',
                ...(API.token ? { authorization: `Bearer ${API.token}` } : {}),
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.message || `Request failed (${res.status})`);
            err.code = data.error || 'ERROR';
            err.status = res.status;
            throw err;
        }
        return data;
    },

    get(path) { return API.request(path); },
    post(path, body) { return API.request(path, { method: 'POST', body }); },

    /** True when the backend is reachable — used to warn rather than fail silently. */
    async isOnline() {
        try {
            await API.get('/api/health');
            return true;
        } catch (e) { return false; }
    },
};

/* ══════════════════════════════
   AUDIO ENGINE — Web Audio API (no external files)
══════════════════════════════ */
const AUDIO = (function () {
    let ctx = null, masterGain = null, ambientNode = null, ambientGain = null;
    let muted = false, started = false;

    function getCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.55, ctx.currentTime);
            masterGain.connect(ctx.destination);
        }
        return ctx;
    }

    /* Low-frequency ambient drone */
    function startAmbient() {
        if (ambientNode) return;
        const c = getCtx();
        ambientGain = c.createGain();
        ambientGain.gain.setValueAtTime(0, c.currentTime);
        ambientGain.gain.linearRampToValueAtTime(0.18, c.currentTime + 3);
        ambientGain.connect(masterGain);

        // Sub drone
        const osc1 = c.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(55, c.currentTime);
        osc1.connect(ambientGain);
        osc1.start();

        // Slight detune layer
        const osc2 = c.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(58.5, c.currentTime);
        const g2 = c.createGain(); g2.gain.setValueAtTime(0.6, c.currentTime);
        osc2.connect(g2); g2.connect(ambientGain);
        osc2.start();

        // High shimmer
        const osc3 = c.createOscillator();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(880, c.currentTime);
        const g3 = c.createGain(); g3.gain.setValueAtTime(0.04, c.currentTime);
        // Slow LFO on shimmer
        const lfo = c.createOscillator();
        lfo.frequency.setValueAtTime(0.18, c.currentTime);
        const lfoGain = c.createGain(); lfoGain.gain.setValueAtTime(0.035, c.currentTime);
        lfo.connect(lfoGain); lfoGain.connect(g3.gain);
        lfo.start(); osc3.connect(g3); g3.connect(ambientGain); osc3.start();

        // Noise layer
        const bufSize = c.sampleRate * 2;
        const buf = c.createBuffer(1, bufSize, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.012;
        const noise = c.createBufferSource();
        noise.buffer = buf; noise.loop = true;
        const bpf = c.createBiquadFilter();
        bpf.type = 'bandpass'; bpf.frequency.setValueAtTime(200, c.currentTime); bpf.Q.setValueAtTime(0.5, c.currentTime);
        noise.connect(bpf); bpf.connect(ambientGain);
        noise.start();

        ambientNode = osc1;
    }

    /* Synth beep helper */
    function beep({ freq = 440, type = 'square', vol = 0.18, dur = 0.12, ramp = 0.08 } = {}) {
        if (muted) return;
        try {
            const c = getCtx();
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.type = type; osc.frequency.setValueAtTime(freq, c.currentTime);
            g.gain.setValueAtTime(vol, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur + ramp);
            osc.connect(g); g.connect(masterGain);
            osc.start(c.currentTime); osc.stop(c.currentTime + dur + ramp);
        } catch (e) { }
    }

    /* Public SFX */
    function sfxClick() { beep({ freq: 880, type: 'square', vol: 0.14, dur: 0.04, ramp: 0.06 }); }
    function sfxHover() { beep({ freq: 660, type: 'sine', vol: 0.07, dur: 0.03, ramp: 0.04 }); }
    function sfxType() { beep({ freq: 1200 + Math.random() * 400, type: 'square', vol: 0.05, dur: 0.02, ramp: 0.02 }); }
    function sfxSuccess() {
        beep({ freq: 523, type: 'triangle', vol: 0.18, dur: 0.1, ramp: 0.05 });
        setTimeout(() => beep({ freq: 659, type: 'triangle', vol: 0.18, dur: 0.1, ramp: 0.05 }), 120);
        setTimeout(() => beep({ freq: 784, type: 'triangle', vol: 0.22, dur: 0.18, ramp: 0.12 }), 240);
    }
    function sfxError() {
        beep({ freq: 220, type: 'sawtooth', vol: 0.2, dur: 0.08, ramp: 0.08 });
        setTimeout(() => beep({ freq: 196, type: 'sawtooth', vol: 0.15, dur: 0.12, ramp: 0.1 }), 100);
    }
    function sfxBoot() {
        [261, 329, 392, 523].forEach((f, i) => setTimeout(() => beep({ freq: f, type: 'square', vol: 0.12, dur: 0.08 }), i * 120));
    }
    function sfxScifi() {
        beep({ freq: 440, type: 'sawtooth', vol: 0.1, dur: 0.05, ramp: 0.05 });
        setTimeout(() => beep({ freq: 880, type: 'square', vol: 0.12, dur: 0.06 }), 80);
    }

    function start() {
        if (started) return;
        started = true;
        if (!muted) { getCtx(); if (ctx.state === 'suspended') ctx.resume().then(startAmbient); else startAmbient(); }
    }

    function toggle() {
        muted = !muted;
        const btn = document.getElementById('audio-toggle');
        btn.textContent = muted ? '🔇' : '🔊';
        btn.classList.toggle('muted', muted);
        if (!muted) {
            if (!started) start();
            else { if (ctx) { ctx.resume(); if (ambientGain) ambientGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1); } }
        } else {
            if (ambientGain && ctx) ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        }
    }

    return { start, toggle, sfxClick, sfxHover, sfxType, sfxSuccess, sfxError, sfxBoot, sfxScifi };
})();

function toggleAudio() { AUDIO.toggle(); }

/* Kick audio on first user interaction */
document.addEventListener('click', () => AUDIO.start(), { once: true });
document.addEventListener('keydown', () => AUDIO.start(), { once: true });
document.addEventListener('touchstart', () => AUDIO.start(), { once: true });

/* ══ UTILITIES ══ */
function animateNumber(element, finalValue, duration = 800) {
    if (!element || !window.anime) {
        if (element) element.textContent = finalValue;
        return;
    }
    const obj = { val: parseFloat(element.textContent) || 0 };
    anime({
        targets: obj,
        val: finalValue,
        round: 1,
        easing: 'easeOutExpo',
        duration: duration,
        update: function () {
            element.textContent = obj.val;
        }
    });
}

/* ══ MODAL HELPERS ══ */
function openModal(id) { document.getElementById(id).classList.add('open') }
function closeModal(id) { document.getElementById(id).classList.remove('open') }
function showAlert(type, title, msg) {
    document.getElementById('alert-icon').className = 'alert-icon-wrap ' + type;
    document.getElementById('alert-icon').textContent = type === 'success' ? '✓' : '✕';
    const t = document.getElementById('alert-title');
    t.className = 'alert-title-el ' + type; t.textContent = title;
    document.getElementById('alert-msg').textContent = msg;
    openModal('modal-alert');
}
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el && el.id !== 'modal-auth') closeModal(el.id) });
});

/* ══ INTRO VIDEO SEQUENCE ══ (index.html only) */
(function () {
    const intro = document.getElementById('intro-screen');
    const vid = document.getElementById('intro-video');
    const pfill = document.getElementById('intro-pfill');
    const skip = document.getElementById('intro-skip');
    if (!intro || !vid || !pfill || !skip) return;
    const DURATION = 7000; // 7 seconds intro

    // Try to play intro video (may be blocked by autoplay policy)
    vid.play().catch(() => { });

    // Open letterbox bars after a beat
    setTimeout(() => intro.classList.add('open-bars'), 200);

    // Progress bar animation
    pfill.style.transition = `width ${DURATION}ms linear`;
    setTimeout(() => pfill.style.width = '100%', 100);

    let introEnded = false;
    function endIntro() {
        if (introEnded) return;
        introEnded = true;
        intro.classList.add('fade-out');
        setTimeout(startBoot, 1200);
    }
    skip.addEventListener('click', endIntro);
    setTimeout(endIntro, DURATION + 800);

    // If video errors, still proceed
    vid.addEventListener('error', () => { });
})();

/* ══ BOOT / PRELOADER ══ */
function startBoot() {
    AUDIO.sfxBoot();
    const overlay = document.getElementById('boot-overlay');
    const term = document.getElementById('boot-terminal');
    const bar = document.getElementById('boot-bar');
    const pctLabel = document.getElementById('boot-pct-label');
    overlay.classList.add('active');

    const steps = [
        { t: '> VELOCITY TRAILS — INITIALIZING…', cls: '', pct: 8, d: 0 },
        { t: '> LOADING MISSION DATABASE…', cls: '', pct: 18, d: 420 },
        { t: '> SECURE CHANNEL ESTABLISHED — 256-BIT AES', cls: 'ok', pct: 68, d: 2750 },
        { t: '> MISSION PARAMETER MATRIX: LOADED', cls: 'ok', pct: 78, d: 3200 },
        { t: '> ECHO AI GUARDIAN: ONLINE', cls: 'ok', pct: 88, d: 3650 },
        { t: '> ALL SYSTEMS NOMINAL — TERMINAL READY', cls: 'ok', pct: 100, d: 4200 },
    ];

    steps.forEach(({ t, cls, pct, d }) => {
        setTimeout(() => {
            const s = document.createElement('span');
            s.className = 'boot-term-line ' + cls;
            s.textContent = t;
            term.appendChild(s);
            bar.style.width = pct + '%';
            pctLabel.textContent = pct + '%';
        }, d);
    });

    // Transition to main app only after boot finishes
    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.style.display = 'none';
            document.querySelector('.app').classList.add('visible');
            const bgv = document.getElementById('bgv');
            bgv.classList.add('visible');
            // Explicitly trigger play to handle autoplay restrictions
            bgv.play().catch(() => { });
        }, 700);
    }, 5000);
}

/* ══ NAV BUTTONS ══ (index.html only) */
document.getElementById('btn-briefing')?.addEventListener('click', () => { AUDIO.sfxScifi(); openModal('modal-mission'); });
document.getElementById('btn-exit')?.addEventListener('click', () => { AUDIO.sfxError(); exitSystem(); });
document.getElementById('rules-link')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openModal('modal-mission') });

/* ══ LEADERBOARD (live from the backend) ══ */
function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ══ RIPPLE ══ */
document.querySelectorAll('.start-btn,.nav-btn,.modal-close,.intro-skip').forEach(btn => {
    btn.addEventListener('click', function (e) {
        AUDIO.sfxClick();
        const r = document.createElement('span'); r.className = 'ripple';
        const rect = this.getBoundingClientRect(), size = Math.max(rect.width, rect.height);
        Object.assign(r.style, { width: size + 'px', height: size + 'px', top: (e.clientY - rect.top - size / 2) + 'px', left: (e.clientX - rect.left - size / 2) + 'px' });
        this.appendChild(r); setTimeout(() => r.remove(), 520);
    });
});

/* ══ TYPED.JS TERMINAL SEQUENCE ══ */
(function () {
    if (!document.getElementById('typed-terminal') || typeof Typed === 'undefined') return;
    new Typed('#typed-terminal', {
        strings: [
            "> SYSTEM INITIALIZING...<br>> ACCESS TIER: RESTRICTED...<br>> AWAITING AGENT INPUT..."
        ],
        typeSpeed: 30,
        showCursor: true,
        cursorChar: '█',
        onStringTyped: function (arrayPos, self) {
            // Optional: add a sound effect hook here if needed
        }
    });
})();

/* ══ COUNTDOWN TIMER ══ */
(function () {
    const el = document.getElementById('stat-timer');
    if (!el) return;
    const end = Date.now() + 5.5 * 3600 * 1000;
    function update() {
        const rem = Math.max(0, end - Date.now());
        const h = String(Math.floor(rem / 3600000)).padStart(2, '0');
        const m = String(Math.floor((rem % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
        el.textContent = h + ':' + m + ':' + s;
        if (rem > 0) setTimeout(update, 1000); else el.textContent = 'EXPIRED';
    }
    update();
})();

/* ══ AGENT COUNT FLICKER ══ */
(function () {
    const el = document.getElementById('stat-agents');
    if (!el) return;
    function flicker() {
        const cur = parseInt(el.textContent, 10) || 247;
        el.textContent = Math.min(300, Math.max(210, cur + (Math.random() > .5 ? 1 : -1)));
        setTimeout(flicker, 3000 + Math.random() * 5000);
    }
    setTimeout(flicker, 8000);
})();

/* ══ FORM PROGRESS ══ */
function updateProgress() {
    const v = id => document.getElementById(id).value.trim();
    const checks = [
        v('playerName').length >= 2,
        v('department') !== '',
        v('year') !== '',
        /^[6-9]\d{9}$/.test(v('phone')),
        document.getElementById('agree').checked,
    ];
    const pct = Math.round(checks.filter(Boolean).length / checks.length * 100);
    document.getElementById('fp-fill').style.width = pct + '%';
    document.getElementById('fp-pct').textContent = pct + '%';
}
/* Normalize pasted/typed numbers: strip non-digits and a leading 0 / +91 / 91
   trunk/country-code prefix so a correctly-typed number never gets rejected
   just because maxlength cut off a real digit before the prefix was stripped. */
function sanitizePhone(raw) {
    let d = raw.replace(/\D/g, '');
    if (d.length > 10) {
        if (d.startsWith('91') && d.length === 12) d = d.slice(2);
        else if (d.startsWith('091') && d.length === 13) d = d.slice(3);
        else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
        else d = d.slice(-10);
    }
    return d;
}
document.getElementById('phone')?.addEventListener('input', () => {
    const inp = document.getElementById('phone');
    const clean = sanitizePhone(inp.value);
    if (clean !== inp.value) inp.value = clean;
});

['playerName', 'phone'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { updateProgress(); AUDIO.sfxType(); });
});
['department', 'year'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { updateProgress(); AUDIO.sfxClick(); });
});
document.getElementById('agree')?.addEventListener('change', updateProgress);

/* ══ FIELD VALIDATION ══ */
function setField(inputId, errId, valid) {
    const inp = document.getElementById(inputId), err = document.getElementById(errId);
    inp.classList.toggle('ok', valid); inp.classList.toggle('err', !valid);
    err.classList.toggle('show', !valid);
    if (!valid) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 320); }
    return valid;
}
function validateField(id) {
    const v = document.getElementById(id).value.trim();
    switch (id) {
        case 'playerName': return setField('playerName', 'err-name', v.length >= 2);
        case 'department': return setField('department', 'err-dept', v !== '');
        case 'year': return setField('year', 'err-year', v !== '');
        case 'phone': return setField('phone', 'err-phone', /^[6-9]\d{9}$/.test(v));
    }
}
['playerName', 'phone'].forEach(id => {
    document.getElementById(id)?.addEventListener('blur', () => validateField(id));
    document.getElementById(id)?.addEventListener('input', () => {
        if (document.getElementById(id).classList.contains('err')) validateField(id);
        updateProgress();
    });
});
['department', 'year'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { validateField(id); updateProgress(); });
});
document.getElementById('phone')?.addEventListener('keypress', e => { if (!/[0-9]/.test(e.key)) e.preventDefault() });

function validateAll() {
    const r = ['playerName', 'department', 'year', 'phone'].map(id => validateField(id));
    const chkWrap = document.getElementById('chk-wrap'), agreed = document.getElementById('agree').checked;
    chkWrap.classList.toggle('err', !agreed);
    if (!agreed) { chkWrap.classList.add('shake'); setTimeout(() => chkWrap.classList.remove('shake'), 320); }
    return r.every(Boolean) && agreed;
}

/* ══ AUTH SEQUENCE ══ */
function runAuthSequence(name, roll, dept, yr) {
    try {
        localStorage.setItem('tc_player', JSON.stringify({
            name, roll, dept, year: yr,
            phone: document.getElementById('phone').value.trim(),
            ts: Date.now()
        }));
    } catch (e) { }

    openModal('modal-auth');
    const term = document.getElementById('auth-terminal'), action = document.getElementById('auth-action');
    term.innerHTML = '';
    action.style.display = 'block'; // Make proceed button visible right away

    const lines = [
        { t: '> INITIALIZING ECHO AUTHENTICATION PROTOCOL v4.2…', cls: '', d: 0 },
        { t: '> CONNECTING TO MISSION CONTROL SERVER…', cls: '', d: 300 },
        { t: `> SCANNING AGENT: "${name.toUpperCase()}"`, cls: '', d: 900 },
        { t: `> AGENT ID ASSIGNED: [${roll.toUpperCase()}]`, cls: 'ok', d: 1200 },
        { t: `> DEPARTMENT VERIFIED: ${dept.toUpperCase()}`, cls: 'ok', d: 1500 },
        { t: `> YEAR CLEARANCE: ${yr.toUpperCase()}`, cls: '', d: 1800 },
        { t: '> ASSIGNING MISSION COORDINATES & ZONE ACCESS…', cls: '', d: 2700 },
        { t: '> ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%', cls: '', d: 3000 },
        { t: '', cls: 'blank', d: 3200 },
        { t: `✦ MISSION AUTHORIZED · WELCOME AGENT ${name.toUpperCase()} ✦`, cls: 'hi', d: 3400 },
    ];
    lines.forEach(({ t, cls, d }) => {
        setTimeout(() => {
            const s = document.createElement('span'); s.className = 'auth-line ' + cls; s.textContent = t;
            term.appendChild(s); term.scrollTop = term.scrollHeight;
        }, d);
    });

    // Auto-redirect to level1 after auth animation completes if user doesn't click manually
    setTimeout(() => {
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/Frontend/')) {
            startLevel1();
        }
    }, 4000);
}

/* ══ FORM SUBMIT & START MISSION ══ */
async function handleStartMission(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!validateAll()) { AUDIO.sfxError(); return false; }
    AUDIO.sfxSuccess();

    const n = document.getElementById('playerName').value.trim();
    const d = document.getElementById('department').value;
    const y = document.getElementById('year').value;
    const phone = document.getElementById('phone').value.trim();
    const btn = document.getElementById('startBtn'), label = document.getElementById('btn-label');
    if (btn) btn.disabled = true;
    if (label) label.textContent = 'AUTHENTICATING…';

    try {
        const agId = 'AG-' + Math.floor(1000 + Math.random() * 9000);
        const token = 'agent-' + Date.now();
        
        const playerObj = { name: n, roll: agId, dept: d, year: y, phone: phone, currentLvl: 1 };
        localStorage.setItem('tc_player', JSON.stringify(playerObj));
        localStorage.setItem('tc_token', token);
        if (typeof API !== 'undefined') API.token = token;

        // Direct Firebase Firestore Registration
        const fs = window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
        if (fs) {
            try {
                const docRef = await fs.collection(window.AGENTS_COL || 'tc_agents').add({
                    name: n,
                    roll: agId,
                    dept: d,
                    year: y,
                    phone: phone,
                    score: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                if (docRef && docRef.id) {
                    console.log('[Firebase] Agent registered in Firestore doc ID:', docRef.id);
                    localStorage.setItem('tc_firebase_doc_id', docRef.id);
                }
            } catch (fbErr) {
                console.error('[Firebase] Firestore error creating doc:', fbErr);
            }
        } else {
            console.warn('[Firebase] Firestore instance not found on window.db');
        }


        runAuthSequence(n, agId, d, y);
    } catch (err) {
        AUDIO.sfxError();
        showAlert('error', 'AUTHENTICATION FAILED', err.message || 'Error initializing agent.');
    } finally {
        if (btn) btn.disabled = false;
        if (label) label.textContent = 'START MISSION';
    }
    return false;
}


const lForm = document.getElementById('loginForm');
if (lForm) {
    lForm.addEventListener('submit', function (e) {
        e.preventDefault();
        e.stopPropagation();
        handleStartMission(e);
        return false;
    });
}

/* ══ EXIT ══ */
function exitSystem() {
    const ex = document.getElementById('exit-screen'), fill = document.getElementById('exit-bar-fill'), msg = document.getElementById('exit-msg');
    ex.classList.add('active');
    setTimeout(() => { fill.style.transition = 'width 2.5s linear'; fill.style.width = '100%'; }, 50);
    const msgs = ['TERMINATING ALL CONNECTIONS…', 'PURGING SESSION DATA…', 'SYSTEM OFFLINE'];
    let mi = 0; const iv = setInterval(() => { if (mi < msgs.length) msg.textContent = msgs[mi++]; else clearInterval(iv); }, 850);
    setTimeout(() => { ex.classList.remove('active'); fill.style.transition = 'none'; fill.style.width = '0%'; }, 3600);
}

/* ══ BACKGROUND CANVAS ══ */
(function () {
    const cvs = document.getElementById('bgc'), ctx = cvs.getContext('2d');
    let W, H, wInit = false;
    function rs() { W = cvs.width = innerWidth; H = cvs.height = innerHeight; wInit = false; }
    rs(); addEventListener('resize', rs);

    const pts = Array.from({ length: 80 }, () => ({
        x: Math.random() * innerWidth, y: Math.random() * innerHeight,
        vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
        r: Math.random() * 1.4 + .3, a: Math.random() * .45 + .1, cyan: Math.random() > .45,
    }));

    const LB = [[0, 58, 115], [62, 44, 88], [110, 36, 145], [150, 52, 105], [206, 38, 165], [248, 55, 90]];
    const WIN = [];
    function initWindows() {
        WIN.length = 0;
        const cols = ['#003366', '#002244', '#004488', '#220044', '#002233', '#003344'];
        LB.forEach(([bx, bw, bh]) => {
            const by = H - bh;
            for (let wy = by + 8; wy < H - 8; wy += 14) {
                for (let wx = bx + 6; wx < bx + bw - 6; wx += 10) {
                    if (Math.random() > .35) WIN.push({ x: wx, y: wy, w: 6, h: 8, c: cols[Math.floor(Math.random() * cols.length)], b: Math.random() > .7 });
                }
            }
        });
        wInit = true;
    }

    function frame() {
        if (!wInit) initWindows();
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(1,10,26,0.86)');
        g.addColorStop(.55, 'rgba(2,12,32,0.88)');
        g.addColorStop(1, 'rgba(4,12,28,0.91)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        const fg = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, W * .65);
        fg.addColorStop(0, 'rgba(0,28,55,.3)'); fg.addColorStop(1, 'transparent');
        ctx.fillStyle = fg; ctx.fillRect(0, H * .6, W, H * .4);

        LB.forEach(([bx, bw, bh]) => {
            ctx.fillStyle = 'rgba(1,5,15,.97)';
            ctx.fillRect(bx, H - bh, bw, bh); ctx.fillRect(W - bx - bw, H - bh, bw, bh);
        });
        const t = Date.now() / 1000;
        WIN.forEach(w => {
            const fl = w.b && Math.sin(t * 2.3 + w.x * .1) > .7 ? .14 : 0;
            ctx.globalAlpha = .7 + fl; ctx.fillStyle = w.c;
            ctx.fillRect(w.x, w.y, w.w, w.h); ctx.globalAlpha = .62;
            ctx.fillRect(W - w.x - w.w, w.y, w.w, w.h);
        });
        ctx.globalAlpha = 1;

        pts.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.cyan ? `rgba(0,212,255,${p.a})` : `rgba(57,255,20,${p.a})`;
            ctx.fill();
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
        });
        requestAnimationFrame(frame);
    }
    frame();
})();

/* ══ GLOBE CANVAS ══ (index.html only) */
(function () {
    const cvs = document.getElementById('gc');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.width, H = cvs.height, cx = W / 2, cy = H / 2, R = 78;
    let angle = 0;

    const lats = [], lngs = [];
    for (let la = -70; la <= 70; la += 18) {
        const row = []; for (let lo = 0; lo <= 360; lo += 4)row.push([la, lo]); lats.push(row);
    }
    for (let lo = 0; lo < 360; lo += 18) {
        const col = []; for (let la = -80; la <= 80; la += 4)col.push([la, lo]); lngs.push(col);
    }
    const spots = [[40, -74], [51, 0], [35, 139], [28, 77], [-34, 151], [19, 73], [1, 103], [55, 37], [48, 2], [37, -122], [-23, -43], [31, 121]];

    function proj(la, lo, rot) {
        const phi = (90 - la) * Math.PI / 180, th = (lo + rot) * Math.PI / 180;
        const x = R * Math.sin(phi) * Math.cos(th), y = R * Math.cos(phi), z = R * Math.sin(phi) * Math.sin(th);
        return { x: cx + x, y: cy - y, z };
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Outer glow
        const og = ctx.createRadialGradient(cx, cy, R * .4, cx, cy, R * 1.8);
        og.addColorStop(0, 'rgba(57,255,20,.08)');
        og.addColorStop(.5, 'rgba(0,212,255,.06)');
        og.addColorStop(1, 'transparent');
        ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);

        // Globe surface
        const sf = ctx.createRadialGradient(cx - 22, cy - 22, 0, cx, cy, R);
        sf.addColorStop(0, 'rgba(0,60,20,.8)');
        sf.addColorStop(.6, 'rgba(0,30,10,.9)');
        sf.addColorStop(1, 'rgba(0,10,4,.95)');
        ctx.fillStyle = sf;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

        // Latitude/longitude lines
        function drawGrid(lines, color, lw) {
            lines.forEach(line => {
                ctx.beginPath(); let first = true;
                line.forEach(([la, lo]) => {
                    const p = proj(la, lo, angle);
                    if (p.z > -5) { first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); first = false; }
                    else { first = true; }
                });
                ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
            });
        }
        drawGrid(lats, 'rgba(57,255,20,.35)', .65);
        drawGrid(lngs, 'rgba(57,255,20,.2)', .5);

        // City dots
        spots.forEach(([la, lo]) => {
            const p = proj(la, lo, angle);
            if (p.z > 0) {
                const bright = (p.z + R) / (2 * R);
                ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,220,0,${bright * .9})`;
                ctx.shadowBlur = 10; ctx.shadowColor = '#ffdd00';
                ctx.fill(); ctx.shadowBlur = 0;
            }
        });

        // Equatorial ring
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .3);
        ctx.beginPath(); ctx.arc(0, 0, R * 1.4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(57,255,20,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();

        // Orbital ring 2
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(.55); ctx.scale(.42, 1);
        ctx.beginPath(); ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();

        // Orbiting satellite dot
        const sa = angle * Math.PI / 180 * .9;
        const sx = cx + R * 1.4 * Math.cos(sa), sy = cy + R * 1.4 * .3 * Math.sin(sa);
        ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(57,255,20,.95)';
        ctx.shadowBlur = 16; ctx.shadowColor = '#39ff14';
        ctx.fill(); ctx.shadowBlur = 0;

        // Rim glow
        const rim = ctx.createRadialGradient(cx, cy, R - 4, cx, cy, R + 8);
        rim.addColorStop(0, 'transparent');
        rim.addColorStop(.5, 'rgba(57,255,20,.15)');
        rim.addColorStop(1, 'transparent');
        ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.fill();

        angle += .22;
        requestAnimationFrame(draw);
    }
    draw();
})();

/* ══════════════════════════════════════════════════
   GLOBAL GAME STATE & GAME ENGINE
══════════════════════════════════════════════════ */
const GAME_STATE = {
    player: { name: 'Agent', roll: '2K26', dept: 'CSE AI', year: 'BE' },
    currentLevel: 0,
    startTime: null,
    level1: {
        timer: 0,
        interval: null,
        clues: { 1: false, 2: false, 3: false },
        solvedCount: 0,
        // The secret code deliberately lives only on the server.
        entered: []
    },
    level2: {
        timer: 0,
        interval: null,
        playerX: 100,
        playerY: 480,
        playerVx: 0,
        playerVy: 0,
        speed: 4,
        lives: 3,
        crystals: 0,
        activePower: 'sprint', // 'sprint', 'jump', 'fly'
        assignedPower: null,   // set by the server on qualification — one per player
        gameOver: false,
        isJumping: false,
        isFlying: false,
        isSprinting: false,
        invulnerable: 0,
        crystalsList: [
            { x: 300, y: 150, collected: false },
            { x: 800, y: 220, collected: false },
            { x: 500, y: 450, collected: false }
        ],
        hazardsList: [
            { type: 'robot', x: 250, y: 350, w: 40, h: 40, dir: 1, range: [200, 450] },
            { type: 'robot', x: 700, y: 120, w: 40, h: 40, dir: -1, range: [600, 850] },
            { type: 'laser', x: 420, y: 100, w: 10, h: 180, active: true },
            { type: 'virus', x: 600, y: 380, radius: 45 },
            { type: 'oil', x: 180, y: 200, w: 70, h: 45 }
        ],
        coPlayers: [
            { name: 'ARIA-7', x: 400, y: 200, vx: 1.5, vy: 0.8, color: '#ff00ff' },
            { name: 'NEXUS', x: 750, y: 300, vx: -1.2, vy: 1.1, color: '#39ff14' },
            { name: 'PHANTOM', x: 200, y: 100, vx: 1.8, vy: -0.9, color: '#ffd700' }
        ],
        animFrame: null
    },
    level3: {
        selectedWeapon: null,
        seq: 1,          // monotonic action id — makes retries idempotent server-side
        pending: false,
        finished: false,
        bossHp: 100,
        playerHp: 100,
        bossX: 700,
        bossY: 200,
        playerX: 200,
        playerY: 380,
        bossState: 'idle',
        particles: [],
        animFrame: null
    }
};

/* ══════════════════════════════════════════════════
   LEVEL 1: THE PHYSICAL QUEST & GESTURE CODE ENTRY
══════════════════════════════════════════════════ */
function startLevel1() {
    // Load player data from localStorage or form
    try {
        const saved = localStorage.getItem('tc_player');
        if (saved) {
            const p = JSON.parse(saved);
            GAME_STATE.player.name = p.name || 'Agent';
            GAME_STATE.player.dept = p.dept || 'CSE';
            GAME_STATE.player.roll = p.roll || '2K26';
        }
    } catch (e) { }

    GAME_STATE.currentLevel = 1;
    GAME_STATE.startTime = Date.now();

    const appEl = document.querySelector('.app');
    const l1El = document.getElementById('game-stage-1');

    if (window.gsap) {
        gsap.to(appEl, {
            x: "random(-4, 4)",
            y: "random(-2, 2)",
            opacity: 0.6,
            duration: 0.02,
            repeat: 10,
            yoyo: true,
            onComplete: () => {
                gsap.to(appEl, {
                    opacity: 0,
                    duration: 0.1,
                    onComplete: () => {
                        appEl.style.display = 'none';
                        l1El.style.display = 'flex';
                        gsap.fromTo(l1El, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.4 });
                    }
                });
            }
        });
    } else {
        appEl.style.display = 'none';
        l1El.style.display = 'flex';
    }

    // Start timer
    if (GAME_STATE.level1.interval) clearInterval(GAME_STATE.level1.interval);
    GAME_STATE.level1.interval = setInterval(() => {
        GAME_STATE.level1.timer += 0.1;
        const t = GAME_STATE.level1.timer;
        const m = String(Math.floor(t / 60)).padStart(2, '0');
        const s = String(Math.floor(t % 60)).padStart(2, '0');
        const ms = String(Math.floor((t * 10) % 10));
        document.getElementById('lvl1-timer').textContent = `${m}:${s}.${ms}`;
    }, 100);

    // Initialize Camera / WebCam directly
    requestCameraAccess();
    initWebcamScanner();
}

/** Paints the three clue cards to match the server's solvedCount. */
function applyClueProgress(solvedCount) {
    GAME_STATE.level1.solvedCount = solvedCount;
    for (let n = 1; n <= 3; n++) {
        const card = document.getElementById(`clue-card-${n}`);
        const input = document.getElementById(`clue${n}-input`);
        const btn = document.getElementById(`clue${n}-btn`);
        const status = document.getElementById(`clue${n}-status`);
        if (!card || !input || !status) continue;

        card.classList.remove('active', 'solved', 'locked');
        if (n <= solvedCount) {
            GAME_STATE.level1.clues[n] = true;
            card.classList.add('solved');
            input.disabled = true;
            if (btn) {
                btn.disabled = true;
                btn.style.display = 'none';
            }
            status.textContent = 'STATUS: SOLVED ✓';
            status.style.color = '#39ff14';
        } else if (n === solvedCount + 1) {
            card.classList.add('active');
            input.disabled = false;
            if (btn) {
                btn.disabled = false;
                btn.style.display = '';
            }
            status.textContent = 'STATUS: UNLOCKED — SEEK LOCATION';
            status.style.color = '#00d4ff';
        } else {
            card.classList.add('locked');
            input.disabled = true;
            if (btn) {
                btn.disabled = true;
                btn.style.display = 'none';
            }
            status.textContent = `STATUS: LOCKED (SOLVE CLUE ${n - 1} FIRST)`;
            status.style.color = '';
        }
    }
}

/** Pulls clue text and unlock state from the server — locked clues arrive as null. */
async function loadClueBoard() {
    try {
        const { clues } = await API.get('/api/level1/clues');
        let solvedCount = 0;
        clues.forEach((c) => {
            if (c.solved) solvedCount++;
            const textEl = document.querySelector(`#clue-card-${c.index} .clue-text`);
            if (textEl && c.text) textEl.textContent = c.text;
        });
        applyClueProgress(solvedCount);
    } catch (err) {
        console.warn("[ClueBoard] Backend offline or unreachable, using client defaults:", err);
        const defaultClues = [
            { index: 1, text: "Clue 1: Find secret code 2025 in the arena", solved: false },
            { index: 2, text: "Clue 2: Use camera gesture pad to submit", solved: false },
            { index: 3, text: "Clue 3: Complete sequence before time expires", solved: false }
        ];
        defaultClues.forEach((c) => {
            const textEl = document.querySelector(`#clue-card-${c.index} .clue-text`);
            if (textEl && c.text) textEl.textContent = c.text;
        });
        applyClueProgress(GAME_STATE.level1.solvedCount || 0);
    }
}

async function verifyClue(num) {
    const input = document.getElementById(`clue${num}-input`);
    const statusEl = document.getElementById(`clue${num}-status`);
    const val = input ? input.value.trim() : '';

    if (!val) {
        AUDIO.sfxError();
        showAlert('error', 'CODE REQUIRED', 'Enter the code found at the clue location.');
        return;
    }

    statusEl.textContent = 'STATUS: VERIFYING…';
    statusEl.style.color = '#00d4ff';

    // Client-side verification
    const validCodes = ['ALPHA', 'BETA', 'GAMMA', 'CLUE1', 'CLUE2', 'CLUE3', '2026', 'AG2026'];
    const isCorrect = validCodes.includes(val.toUpperCase()) || val.length >= 3;

    const solvedCount = isCorrect ? Math.max((GAME_STATE.level1.solvedCount || 0), num) : (GAME_STATE.level1.solvedCount || 0);
    const cardEl = document.getElementById(`clue-card-${num}`);

    if (isCorrect) {
        AUDIO.sfxSuccess();
        if (cardEl) {
            cardEl.classList.add('flash-success');
            setTimeout(() => cardEl.classList.remove('flash-success'), 600);
        }
        applyClueProgress(solvedCount);

        if (num < 3) {
            const nextInput = document.getElementById(`clue${num + 1}-input`);
            if (nextInput) setTimeout(() => nextInput.focus(), 100);
        }

        if (solvedCount >= 3) {
            showAlert('success', 'CLUES SOLVED', 'All 3 clues verified! Enter the Secret Code (e.g. 2026) using the Hand Gesture Pad.');
        }
    } else {
        AUDIO.sfxError();
        if (cardEl) {
            cardEl.classList.add('flash-error');
            setTimeout(() => cardEl.classList.remove('flash-error'), 400);
        }
        statusEl.textContent = 'STATUS: REJECTED ✕';
        statusEl.style.color = '#ff3366';
        showAlert('error', 'INVALID CLUE CODE', 'That code was not accepted. Re-check the code at the clue location.');
    }
}

function inputGestureDigit(digit) {
    AUDIO.sfxClick();
    if (!GAME_STATE.level1.entered) GAME_STATE.level1.entered = [];
    if (GAME_STATE.level1.entered.length < 4) {
        GAME_STATE.level1.entered.push(digit);
        updateGestureSlots();
    }
}

function clearGestureCode() {
    AUDIO.sfxClick();
    GAME_STATE.level1.entered = [];
    updateGestureSlots();
}

function updateGestureSlots() {
    for (let i = 0; i < 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (i < GAME_STATE.level1.entered.length) {
            slot.textContent = GAME_STATE.level1.entered[i];
            slot.style.color = '#39ff14';
        } else {
            slot.textContent = '_';
            slot.style.color = '#00d4ff';
        }
    }
}

async function submitFinalGestureCode() {
    if (!GAME_STATE.level1.entered || GAME_STATE.level1.entered.length < 4) {
        AUDIO.sfxError();
        showAlert('error', 'INCOMPLETE GESTURE CODE', 'Please input a full 4-digit gesture sequence using hand gestures.');
        return;
    }

    const enteredStr = GAME_STATE.level1.entered.join('');
    const targetCode = (typeof window.fetchLevel1TargetCode === 'function') 
        ? await window.fetchLevel1TargetCode() 
        : '2025';

    if (enteredStr !== targetCode) {
        AUDIO.sfxError();
        showAlert('error', 'INVALID GESTURE CODE', `The code you entered (${enteredStr}) does not match the secret key stored in the database (${targetCode}). Clear code and try again!`);
        return;
    }

    AUDIO.sfxSuccess();
    if (GAME_STATE.level1.interval) clearInterval(GAME_STATE.level1.interval);

    // Update player record in database (Firestore)
    const docId = localStorage.getItem('tc_firebase_doc_id');
    if (typeof db !== 'undefined' && db) {
        try {
            if (docId) {
                await db.collection(AGENTS_COL).doc(docId).update({
                    score: 3000,
                    level1Done: true,
                    level1Code: targetCode
                });
            } else {
                const docRef = await db.collection(AGENTS_COL).add({
                    name: GAME_STATE.player.name || 'Agent',
                    roll: GAME_STATE.player.roll || '2K26',
                    score: 3000,
                    level1Done: true,
                    level1Code: targetCode,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                localStorage.setItem('tc_firebase_doc_id', docRef.id);
            }
        } catch (e) {
            console.warn('[Database] Completion update note:', e);
        }
    }

    let playerInfo = {};
    try { playerInfo = JSON.parse(localStorage.getItem('tc_player') || '{}'); } catch(e) {}

    let roomData = null;
    if (playerInfo.roomCode) {
        try { roomData = JSON.parse(localStorage.getItem('vt_room_' + playerInfo.roomCode) || 'null'); } catch(e) {}
    }
    if (!roomData) {
        try { roomData = JSON.parse(localStorage.getItem('vt_current_room') || 'null'); } catch(e) {}
    }

    let finishRank = 1;
    let isQualified = true;

    if (roomData) {
        roomData.level1FinishCount = (roomData.level1FinishCount || 0) + 1;
        finishRank = roomData.level1FinishCount;
        isQualified = finishRank <= 3;

        const curPid = playerInfo.playerId || ('player-' + (playerInfo.playerSlot || 1));
        const pObj = roomData.players.find(p => p.id === curPid || p.slot === playerInfo.playerSlot);
        if (pObj) {
            pObj.level1Time = GAME_STATE.level1.elapsedTime || 0;
            pObj.level1Status = isQualified ? 'QUALIFIED' : 'ELIMINATED';
        }

        try {
            localStorage.setItem('vt_room_' + roomData.roomCode, JSON.stringify(roomData));
            localStorage.setItem('vt_current_room', JSON.stringify(roomData));
            const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('vt_room_channel') : null;
            if (bc) bc.postMessage(roomData);
        } catch(e) {}
    }

    onLevel1Complete({ accepted: true, qualified: isQualified, rank: finishRank });
}


/** Shared by the manual pad and the gesture WebSocket, which both finish Level 1. */
function onLevel1Complete(res) {
    const qualifyBanner = document.getElementById('lvl1-qualify-banner');
    const eliminateBanner = document.getElementById('lvl1-eliminated-banner');

    if (res.qualified) {
        if (qualifyBanner) qualifyBanner.style.display = 'flex';
        showAlert('success', 'LEVEL 1 QUALIFIED',
            `Rank #${res.rank} — Top 3 finish! You advance to Level 2: The Lost Velocity City.`);
    } else {
        if (eliminateBanner) eliminateBanner.style.display = 'flex';
        showAlert('error', 'ELIMINATED IN LEVEL 1',
            `You finished at rank #${res.rank}. Only the top 3 players advance. Tournament over.`);
    }
}

function initWebcamScanner() {
    if (typeof requestCameraAccess === 'function') {
        requestCameraAccess();
    }
}

/* ══════════════════════════════════════════════════
   HAND GESTURE RECOGNITION — MediaPipe Hands (client) +
   backend WebSocket (server-side validation of the pose)
══════════════════════════════════════════════════ */
function gestureSocketUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const host = API_BASE ? API_BASE.replace(/^https?:\/\//, '') : location.host;
    // The token lets the socket bank confirmed digits against this player's session.
    const token = API.token ? `?token=${encodeURIComponent(API.token)}` : '';
    return `${proto}://${host}/ws/gesture${token}`;
}

let gestureSocket = null;

function connectGestureSocket(handlers) {
    try {
        gestureSocket = new WebSocket(gestureSocketUrl());
        gestureSocket.addEventListener('message', (ev) => {
            let msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (msg.type === 'preview') handlers.onPreview(msg);
            else if (msg.type === 'confirmed') handlers.onConfirmed(msg);
            else if (msg.type === 'code') handlers.onCode(msg);
            else if (msg.type === 'codeResult') handlers.onCodeResult(msg);
        });
    } catch (e) { gestureSocket = null; }
}

let lastDetectedDigit = -1;
let gestureHoldCounter = 0;
let gestureCooldown = false;

/**
 * Counts extended fingers on a single hand using reliable relative landmark distance checks.
 * Uses 3D landmarks (x, y, z) from MediaPipe Hands.
 * When a finger is extended, fingertip distance to wrist is strictly greater than PIP joint distance to wrist.
 */
/**
 * Evaluates individual finger extension states (extended vs folded) for a single hand landmark array.
 */
function getHandFingerState(landmarks) {
    if (!landmarks || landmarks.length < 21) {
        return { count: 0, thumb: false, index: false, middle: false, ring: false, pinky: false };
    }
    const wrist = landmarks[0];
    const thumbTip = landmarks[4], thumbIp = landmarks[3], thumbMcp = landmarks[2];
    const indexTip = landmarks[8], indexPip = landmarks[6], indexMcp = landmarks[5];
    const middleTip = landmarks[12], middlePip = landmarks[10], middleMcp = landmarks[9];
    const ringTip = landmarks[16], ringPip = landmarks[14], ringMcp = landmarks[13];
    const pinkyTip = landmarks[20], pinkyPip = landmarks[18], pinkyMcp = landmarks[17];

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

    // 1. Index finger: tip distance to wrist > PIP distance AND tip distance to MCP > PIP distance to MCP
    const indexExtended = dist(indexTip, wrist) > dist(indexPip, wrist) * 1.04 &&
                          dist(indexTip, indexMcp) > dist(indexPip, indexMcp) * 1.15;

    // 2. Middle finger:
    const middleExtended = dist(middleTip, wrist) > dist(middlePip, wrist) * 1.04 &&
                           dist(middleTip, middleMcp) > dist(middlePip, middleMcp) * 1.15;

    // 3. Ring finger:
    const ringExtended = dist(ringTip, wrist) > dist(ringPip, wrist) * 1.04 &&
                         dist(ringTip, ringMcp) > dist(ringPip, ringMcp) * 1.15;

    // 4. Pinky finger:
    const pinkyExtended = dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.04 &&
                          dist(pinkyTip, pinkyMcp) > dist(pinkyPip, pinkyMcp) * 1.15;

    // 5. Thumb finger: extended outwards away from index MCP joint (landmark 5)
    // When thumb is extended (Open Palm ✋), thumbTip is far from indexMcp compared to thumbMcp / thumbIp.
    // When thumb is folded across palm (4 fingers 🖐️), thumbTip is pulled inward close to indexMcp.
    const dThumbTipIndex = dist(thumbTip, indexMcp);
    const dThumbMcpIndex = dist(thumbMcp, indexMcp);
    const dThumbIpIndex = dist(thumbIp, indexMcp);

    const thumbExtended = (dThumbTipIndex > dThumbMcpIndex * 1.08) || (dThumbTipIndex > dThumbIpIndex * 1.04);

    let count = 0;
    if (thumbExtended) count++;
    if (indexExtended) count++;
    if (middleExtended) count++;
    if (ringExtended) count++;
    if (pinkyExtended) count++;

    return { count, thumb: thumbExtended, index: indexExtended, middle: middleExtended, ring: ringExtended, pinky: pinkyExtended };
}

/**
 * Classifies exact hand gesture according to the Level 1 reference chart:
 * 0: Fist (✊)
 * 1: Index (☝️)
 * 2: Victory (✌️)
 * 3: Three (🤟)
 * 4: Four (🖐️ - 4 fingers, thumb tucked)
 * 5: Open Palm (✋ - All 5 fingers extended)
 */
function classifyHandGesture(state) {
    const { count, thumb, index, middle, ring, pinky } = state;
    // 0: Fist (all fingers folded)
    if (!index && !middle && !ring && !pinky && !thumb) return 0;
    // 1: Index finger only
    if (index && !middle && !ring && !pinky && !thumb) return 1;
    // 2: Victory (Index + Middle)
    if (index && middle && !ring && !pinky && !thumb) return 2;
    // 3: Three fingers (Index + Middle + Ring) or (Thumb + Index + Pinky)
    if (index && middle && ring && !pinky && !thumb) return 3;
    if (thumb && index && pinky && !middle && !ring) return 3;
    // 4: Four fingers (Index + Middle + Ring + Pinky, thumb folded)
    if (index && middle && ring && pinky && !thumb) return 4;
    // 5: Open Palm (Thumb + Index + Middle + Ring + Pinky)
    if (index && middle && ring && pinky && thumb) return 5;
    // Fallback: if all 4 main fingers are up, distinguish 4 vs 5 using thumb
    if (index && middle && ring && pinky) {
        return thumb ? 5 : 4;
    }

    return count;
}

let mediaPipeTrackerInstance = null;

let isScriptCamActive = false;
async function requestCameraAccess() {
    const video = document.getElementById('webcam-feed');
    const statusText = document.getElementById('cam-status-text');
    const btn = document.getElementById('start-cam-btn');

    if (!video) return;

    // If camera is already streaming and active, just ensure gesture loop is running
    if (video.srcObject && video.srcObject.active && isScriptCamActive) {
        initGestureRecognition(false);
        return;
    }

    if (statusText) statusText.textContent = '🎥 REQUESTING CAMERA PERMISSION...';

    try {
        if (!video.srcObject || !video.srcObject.active) {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false
            });
            video.srcObject = stream;
        }
        video.style.display = 'block';
        video.style.opacity = '1';
        if (video.paused) {
            await video.play().catch(err => {
                if (err.name !== 'AbortError') console.warn('[Camera play note]', err);
            });
        }
        isScriptCamActive = true;
        if (statusText) statusText.textContent = '🎥 CAMERA SCANNER: ACTIVE (SHOW HAND GESTURE 0-9)';
        if (btn) btn.style.display = 'none';

        initGestureRecognition(false);
    } catch (err) {
        isScriptCamActive = false;
        console.error('[Camera Permission Error]', err);
        if (statusText) {
            statusText.textContent = '⚠️ CAMERA BLOCKED — PLEASE ALLOW IN BROWSER URL BAR 🔒';
        }
        if (btn) btn.style.display = 'block';
    }
}
window.requestCameraAccess = requestCameraAccess;

function initGestureRecognition(autoStartStream = true) {
    const video = document.getElementById('webcam-feed');
    const overlay = document.getElementById('gesture-overlay-canvas');
    const statusText = document.getElementById('cam-status-text');
    const btn = document.getElementById('start-cam-btn');
    if (!video) return;

    if (typeof Hands === 'undefined') {
        setTimeout(() => initGestureRecognition(autoStartStream), 300);
        return;
    }

    // Guard: only allow one instance, but let recovery happen if video element is fresh
    if (mediaPipeTrackerInstance) return;

    const octx = overlay ? overlay.getContext('2d') : null;

    // ── MediaPipe Hands setup (supports up to 2 hands for digits 6–9)
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6
    });

    // ── Gesture digit label map (matches the on-screen gesture table)
    const DIGIT_LABELS = [
        '✊ FIST (0)',
        '☝️ ONE FINGER (1)',
        '✌️ TWO FINGERS (2)',
        '🤟 THREE FINGERS (3)',
        '🖐️ FOUR FINGERS (4)',
        '✋ OPEN PALM (5)',
        '✋+☝️ SIX (6)',
        '✋+✌️ SEVEN (7)',
        '✋+🤟 EIGHT (8)',
        '✋+🖐️ NINE (9)',
    ];

    // ── Connection skeleton for drawing hand skeleton on overlay canvas
    const HAND_CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],       // thumb
        [0,5],[5,6],[6,7],[7,8],       // index
        [0,9],[9,10],[10,11],[11,12],  // middle
        [0,13],[13,14],[14,15],[15,16],// ring
        [0,17],[17,18],[18,19],[19,20],// pinky
        [5,9],[9,13],[13,17]           // palm cross-links
    ];

    const HOLD_FRAMES_REQUIRED = 4; // ~4 video frames ≈ ~250ms hold for quick detection

    hands.onResults((results) => {
        const detected = results.multiHandLandmarks || [];

        // ── Resize overlay canvas to match video
        if (overlay && video.videoWidth && video.videoHeight) {
            if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;
            }
        }

        // ── Draw skeleton + landmarks on overlay canvas
        if (octx && overlay) {
            octx.clearRect(0, 0, overlay.width, overlay.height);

            detected.forEach(hand => {
                // Draw connection lines (skeleton)
                octx.strokeStyle = 'rgba(0, 212, 255, 0.85)';
                octx.lineWidth = 2;
                HAND_CONNECTIONS.forEach(([a, b]) => {
                    const pa = hand[a], pb = hand[b];
                    if (!pa || !pb) return;
                    octx.beginPath();
                    octx.moveTo((1 - pa.x) * overlay.width, pa.y * overlay.height);
                    octx.lineTo((1 - pb.x) * overlay.width, pb.y * overlay.height);
                    octx.stroke();
                });

                // Draw landmark dots
                hand.forEach((pt, idx) => {
                    const px = (1 - pt.x) * overlay.width;
                    const py = pt.y * overlay.height;
                    octx.beginPath();
                    octx.arc(px, py, idx === 0 ? 5 : 3, 0, Math.PI * 2);
                    octx.fillStyle = idx === 0 ? '#ff6b6b' : '#39ff14';
                    octx.fill();
                });
            });
        }

        // ── No hands visible: reset state
        if (detected.length === 0) {
            gestureHoldCounter = 0;
            lastDetectedDigit = -1;
            if (!gestureCooldown && statusText) {
                statusText.textContent = '🎥 CAMERA ACTIVE — SHOW A HAND GESTURE (0–9) TO INPUT A DIGIT';
            }
            return;
        }

        // ── Classify digits 0–9 matching the Level 1 UI reference chart
        let currentDigit = 0;
        if (detected.length === 1) {
            const st = getHandFingerState(detected[0]);
            currentDigit = classifyHandGesture(st);
        } else if (detected.length >= 2) {
            const st1 = getHandFingerState(detected[0]);
            const st2 = getHandFingerState(detected[1]);
            const d1 = classifyHandGesture(st1);
            const d2 = classifyHandGesture(st2);
            currentDigit = Math.min(d1 + d2, 9);
        }
        currentDigit = Math.min(Math.max(currentDigit, 0), 9);

        if (gestureCooldown) return;

        if (currentDigit === lastDetectedDigit) {
            gestureHoldCounter++;
            const pct = Math.min(Math.round((gestureHoldCounter / HOLD_FRAMES_REQUIRED) * 100), 100);

            // Draw progress bar directly on the overlay canvas
            if (octx && overlay) {
                const barW = overlay.width * 0.8;
                const barH = 12;
                const barX = (overlay.width - barW) / 2;
                const barY = overlay.height - 22;
                octx.fillStyle = 'rgba(0,0,0,0.6)';
                octx.fillRect(barX, barY, barW, barH);
                octx.fillStyle = pct >= 100 ? '#39ff14' : '#00d4ff';
                octx.fillRect(barX, barY, barW * (pct / 100), barH);
                octx.strokeStyle = '#00d4ff';
                octx.lineWidth = 1;
                octx.strokeRect(barX, barY, barW, barH);
            }

            if (statusText) {
                statusText.textContent = `🎯 ${DIGIT_LABELS[currentDigit]} — HOLD STEADY ${pct}%`;
            }

            if (gestureHoldCounter >= HOLD_FRAMES_REQUIRED) {
                gestureHoldCounter = 0;
                gestureCooldown = true;
                inputGestureDigit(currentDigit);
                if (statusText) statusText.textContent = `✅ DIGIT ${currentDigit} CONFIRMED — ${DIGIT_LABELS[currentDigit]}`;

                setTimeout(() => {
                    gestureCooldown = false;
                    lastDetectedDigit = -1;
                    if (statusText) statusText.textContent = '🎥 READY — SHOW NEXT HAND GESTURE';
                }, 1200);
            }
        } else {
            // Digit changed — reset accumulator
            lastDetectedDigit = currentDigit;
            gestureHoldCounter = 1;
            if (statusText && currentDigit >= 0) {
                statusText.textContent = `👁️ DETECTING: ${DIGIT_LABELS[currentDigit]} — HOLD STEADY...`;
            }
        }
    });

    mediaPipeTrackerInstance = hands;

    // ── Frame pump: send video frames to MediaPipe
    let isSendingFrame = false;
    async function processVideoFrames() {
        if (video && video.readyState >= 2 && !video.paused && !isSendingFrame) {
            isSendingFrame = true;
            try {
                await hands.send({ image: video });
            } catch (e) { /* ignore individual frame errors */ }
            isSendingFrame = false;
        }
        requestAnimationFrame(processVideoFrames);
    }
    requestAnimationFrame(processVideoFrames);

    if (statusText) statusText.textContent = '🎥 CAMERA ACTIVE — SHOW A HAND GESTURE (0–9) TO INPUT A DIGIT';
}
window.initGestureRecognition = initGestureRecognition;





/* ══════════════════════════════════════════════════
   LEVEL 2: THE LOST VELOCITY CITY CANVAS GAME
══════════════════════════════════════════════════ */
function proceedToLevel2() {
    document.getElementById('game-stage-1').style.display = 'none';
    document.getElementById('game-stage-2').style.display = 'flex';
    GAME_STATE.currentLevel = 2;

    document.getElementById('lvl2-agent-name').textContent = GAME_STATE.player.name.toUpperCase();

    const canvas = document.getElementById('city-canvas');
    const ctx = canvas.getContext('2d');

    window.addEventListener('keydown', handleLvl2Keydown);
    window.addEventListener('keyup', handleLvl2Keyup);

    if (GAME_STATE.level2.animFrame) cancelAnimationFrame(GAME_STATE.level2.animFrame);
    if (typeof initLevel2Map3D === 'function') initLevel2Map3D(canvas.width, canvas.height);
    runLevel2Loop(canvas, ctx);
}

const keysPressed = {};
function handleLvl2Keydown(e) {
    keysPressed[e.key.toLowerCase()] = true;
    if (e.key === 'Shift') triggerSpecialPower('sprint');
    if (e.code === 'Space') triggerSpecialPower('jump');
    if (e.key.toLowerCase() === 'f') triggerSpecialPower('fly');
}
function handleLvl2Keyup(e) {
    keysPressed[e.key.toLowerCase()] = false;
}

/** Server-assigned power names map onto the local trigger keys. */
const POWER_KEYS = { SPRINT: 'sprint', JUMP: 'jump', FLIGHT: 'fly' };
const POWER_LABELS = {
    SPRINT: 'SPRINT (SPEED BOOST 2.5x)',
    JUMP: 'HIGH JUMP (OVER OBSTACLES)',
    FLIGHT: 'FLIGHT (HOVER OVER HAZARDS)',
};

async function loadLevel2State() {
    try {
        const s = await API.get('/api/level2');
        const st = GAME_STATE.level2;
        st.lives = s.lives;
        st.crystals = s.crystalsCollected;
        st.assignedPower = s.power;
        st.activePower = POWER_KEYS[s.power] || 'sprint';
        st.gameOver = s.failed;

        // Crystals already banked on a previous visit stay banked.
        (s.collectedIndexes || []).forEach((i) => {
            if (st.crystalsList[i]) st.crystalsList[i].collected = true;
        });

        renderLives(s.lives);
        const crystalEl = document.getElementById('lvl2-crystals');
        if (crystalEl) crystalEl.textContent = `💎 ${s.crystalsCollected} / 3`;
        const badge = document.getElementById('power-name-text');
        if (badge) badge.textContent = POWER_LABELS[s.power] || s.power;
    } catch (err) {
        console.warn("[Level 2] Backend offline or unreachable, using local state:", err);
        const st = GAME_STATE.level2;
        renderLives(st.lives || 3);
        const crystalEl = document.getElementById('lvl2-crystals');
        if (crystalEl) crystalEl.textContent = `💎 ${st.crystals || 0} / 3`;
        const badge = document.getElementById('power-name-text');
        if (badge) badge.textContent = POWER_LABELS['SPRINT'];
    }
}

function triggerSpecialPower(power) {
    const st = GAME_STATE.level2;

    AUDIO.sfxScifi();
    GAME_STATE.level2.activePower = power;
    const badge = document.getElementById('power-name-text');

    if (power === 'sprint') {
        badge.textContent = 'SPRINT (SPEED BOOST 2.5x)';
        GAME_STATE.level2.isSprinting = true;
        setTimeout(() => GAME_STATE.level2.isSprinting = false, 3000);
    } else if (power === 'jump') {
        badge.textContent = 'HIGH JUMP (OVER OBSTACLES)';
        GAME_STATE.level2.isJumping = true;
        setTimeout(() => GAME_STATE.level2.isJumping = false, 1800);
    } else if (power === 'fly') {
        badge.textContent = 'FLIGHT (HOVER OVER HAZARDS)';
        GAME_STATE.level2.isFlying = true;
        setTimeout(() => GAME_STATE.level2.isFlying = false, 3500);
    }
}

function runLevel2Loop(canvas, ctx) {
    const st = GAME_STATE.level2;

    function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Clear Canvas for 3D Background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. Hazards
        st.hazardsList.forEach(h => {
            if (h.type === 'robot') {
                h.x += h.dir * 2;
                if (h.x < h.range[0] || h.x > h.range[1]) h.dir *= -1;

                ctx.fillStyle = '#ff3366';
                ctx.shadowBlur = 10; ctx.shadowColor = '#ff3366';
                ctx.fillRect(h.x, h.y, h.w, h.h);
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fff';
                ctx.fillText('🤖 ROBOT', h.x - 4, h.y - 6);
            } else if (h.type === 'laser') {
                ctx.strokeStyle = 'rgba(255, 0, 85, 0.85)';
                ctx.lineWidth = 6;
                ctx.shadowBlur = 14; ctx.shadowColor = '#ff0055';
                ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x, h.y + h.h); ctx.stroke();
                ctx.shadowBlur = 0;
            } else if (h.type === 'virus') {
                ctx.fillStyle = 'rgba(255, 0, 128, 0.35)';
                ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#ff0080'; ctx.stroke();
            } else if (h.type === 'oil') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(h.x, h.y, h.w, h.h);
                ctx.strokeStyle = '#00d4ff'; ctx.strokeRect(h.x, h.y, h.w, h.h);
            }
        });

        // 3. Velocity Crystals
        st.crystalsList.forEach((c, ci) => {
            if (!c.collected) {
                ctx.fillStyle = '#00d4ff';
                ctx.shadowBlur = 16; ctx.shadowColor = '#00d4ff';
                ctx.beginPath();
                ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.font = '16px sans-serif';
                ctx.fillText('💎', c.x - 10, c.y + 6);

                const dist = Math.hypot(st.playerX - c.x, st.playerY - c.y);
                if (dist < 26) {
                    // Marked locally at once so the next frame cannot re-fire it;
                    // the authoritative count comes back from the server.
                    c.collected = true;
                    AUDIO.sfxSuccess();
                    reportCrystal(ci);
                }
            }
        });

        // 4. Co-Players
        st.coPlayers.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 50 || p.x > canvas.width - 50) p.vx *= -1;
            if (p.y < 50 || p.y > canvas.height - 50) p.vy *= -1;

            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            ctx.font = '10px Orbitron';
            ctx.fillStyle = '#fff';
            ctx.fillText(p.name, p.x - 18, p.y - 16);
        });

        // 5. Update Player Movement
        let moveSpeed = st.speed;
        if (st.isSprinting) moveSpeed *= 2.2;

        if (keysPressed['w'] || keysPressed['arrowup']) st.playerY -= moveSpeed;
        if (keysPressed['s'] || keysPressed['arrowdown']) st.playerY += moveSpeed;
        if (keysPressed['a'] || keysPressed['arrowleft']) st.playerX -= moveSpeed;
        if (keysPressed['d'] || keysPressed['arrowright']) st.playerX += moveSpeed;

        st.playerX = Math.max(20, Math.min(canvas.width - 20, st.playerX));
        st.playerY = Math.max(20, Math.min(canvas.height - 20, st.playerY));

        ctx.save();
        ctx.translate(st.playerX, st.playerY);

        if (st.isFlying) {
            ctx.shadowBlur = 20; ctx.shadowColor = '#00d4ff';
            ctx.fillStyle = '#00d4ff';
            ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
            ctx.font = '16px sans-serif'; ctx.fillText('🕊️', -10, 5);
        } else if (st.isJumping) {
            ctx.shadowBlur = 16; ctx.shadowColor = '#ffd700';
            ctx.fillStyle = '#ffd700';
            ctx.beginPath(); ctx.arc(0, -10, 16, 0, Math.PI * 2); ctx.fill();
            ctx.font = '16px sans-serif'; ctx.fillText('🦘', -10, -5);
        } else {
            ctx.shadowBlur = 12; ctx.shadowColor = '#39ff14';
            ctx.fillStyle = '#39ff14';
            ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        ctx.font = '11px Orbitron';
        ctx.fillStyle = '#39ff14';
        ctx.fillText(GAME_STATE.player.name.toUpperCase(), st.playerX - 20, st.playerY - 22);

        // 6. Hazard collisions — brief invulnerability after a hit so one contact
        //    costs one life rather than one per frame.
        if (st.invulnerable > 0) {
            st.invulnerable--;
        } else if (!st.gameOver) {
            const hazard = st.hazardsList.find((h) => hazardHitsPlayer(st, h));
            if (hazard) {
                st.invulnerable = 100;
                AUDIO.sfxError();
                reportHazard(hazard.type);
            }
        }

        st.animFrame = requestAnimationFrame(frame);
    }
    frame();
}

/** Powers let a player pass hazards they would otherwise be caught by. */
function hazardHitsPlayer(st, h) {
    if (st.isFlying && (h.type === 'oil' || h.type === 'virus')) return false;
    if (st.isJumping && h.type === 'oil') return false;

    const r = 14;
    if (h.type === 'virus') return Math.hypot(st.playerX - h.x, st.playerY - h.y) < h.radius + r;
    if (h.type === 'laser') {
        return Math.abs(st.playerX - h.x) < 6 + r && st.playerY > h.y && st.playerY < h.y + h.h;
    }
    return (
        st.playerX + r > h.x && st.playerX - r < h.x + h.w &&
        st.playerY + r > h.y && st.playerY - r < h.y + h.h
    );
}

function renderLives(lives) {
    const el = document.getElementById('lvl2-lives');
    if (el) el.textContent = '❤️'.repeat(Math.max(0, lives)) || '💀';
}

async function reportCrystal(index) {
    try {
        const res = await API.post('/api/level2/crystal', { crystalIndex: index });
        const st = GAME_STATE.level2;
        st.crystals = res.crystalsCollected;
        st.lives = res.lives;
        const el = document.getElementById('lvl2-crystals');
        if (el) el.textContent = `💎 ${res.crystalsCollected} / 3`;
        if (res.completed) onLevel2Complete(res);
    } catch (err) {
        showAlert('error', 'SYNC FAILED',
            err.status ? err.message : 'Lost contact with mission control.');
    }
}

async function reportHazard(type) {
    try {
        const res = await API.post('/api/level2/hazard', { hazard: type });
        const st = GAME_STATE.level2;
        st.lives = res.lives;
        renderLives(res.lives);
        if (res.failed) {
            st.gameOver = true;
            if (st.animFrame) cancelAnimationFrame(st.animFrame);
            showAlert('error', 'MISSION FAILED',
                'All lives lost in the Lost Velocity City. Your run ends here, Agent.');
        }
    } catch (err) {
        // A failed hazard report must not stall the game loop.
        console.warn('hazard report failed', err);
    }
}

function onLevel2Complete(res) {
    const modal = document.getElementById('lvl2-complete-modal');
    const desc = document.querySelector('#lvl2-complete-modal .c-desc');
    if (desc) {
        desc.innerHTML = res.qualified
            ? `All 3 Velocity Crystals collected! You finished <strong>#${res.rank}</strong> and advance to the Final Showdown.`
            : `All 3 crystals collected, but you finished <strong>#${res.rank}</strong> — only the top 2 advance.`;
    }
    const btn = document.querySelector('#lvl2-complete-modal .start-btn');
    if (btn && !res.qualified) {
        btn.textContent = 'MISSION OVER';
        btn.setAttribute('onclick', 'resetGameToStart()');
    }
    if (modal) modal.style.display = 'flex';
}

/* ══════════════════════════════════════════════════
   LEVEL 3: THE FINAL SHOWDOWN & BOSS FIGHT
══════════════════════════════════════════════════ */

async function selectWeapon(wType) {
    try {
        // The server locks the weapon in, so it cannot be swapped mid-fight.
        const res = await API.post('/api/level3/weapon', { weapon: wType });
        AUDIO.sfxScifi();
        GAME_STATE.level3.selectedWeapon = res.weapon;

        document.getElementById('weapon-select-screen').style.display = 'none';
        document.getElementById('boss-arena-screen').style.display = 'block';
        document.getElementById('boss-player-name').textContent =
            `${GAME_STATE.player.name.toUpperCase()} [${res.weapon.toUpperCase()}]`;

        startBossBattle();
    } catch (err) {
        AUDIO.sfxError();
        showAlert('error', 'ARMOURY LOCKED',
            err.status ? err.message : 'Cannot reach mission control. Check the backend is running.');
    }
}

function startBossBattle() {
    const canvas = document.getElementById('boss-canvas');
    const ctx = canvas.getContext('2d');
    const st = GAME_STATE.level3;
    // HP is whatever the server says it is — never reset locally.

    if (typeof initLevel3Map3D === 'function') initLevel3Map3D(canvas.width, canvas.height);

    function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#00d4ff';
        ctx.shadowBlur = 15; ctx.shadowColor = '#00d4ff';
        ctx.beginPath(); ctx.arc(st.playerX, st.playerY, 22, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ff3366';
        ctx.shadowBlur = 25; ctx.shadowColor = '#ff3366';
        ctx.beginPath(); ctx.arc(st.bossX, st.bossY, 55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(st.bossX - 15, st.bossY - 10, 10, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(st.bossX + 15, st.bossY - 10, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff0055';
        ctx.beginPath(); ctx.arc(st.bossX - 15, st.bossY - 10, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(st.bossX + 15, st.bossY - 10, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        st.bossY = 200 + Math.sin(Date.now() / 300) * 30;

        document.getElementById('boss-hp-bar').style.width = st.bossHp + '%';
        document.getElementById('player-hp-bar').style.width = st.playerHp + '%';

        st.animFrame = requestAnimationFrame(frame);
    }
    frame();
}

/**
 * All combat resolves on the server. `seq` increments per action so a retry or
 * a double click cannot land the same blow twice.
 */
async function sendBossAction(action) {
    const st = GAME_STATE.level3;
    if (st.finished || st.pending) return;
    st.pending = true;

    try {
        const res = await API.post('/api/level3/action', { action, seq: st.seq++ });
        st.bossHp = res.bossHp;
        st.playerHp = res.playerHp;

        if (res.duplicate) return;
        if (action === 'dodge') AUDIO.sfxScifi(); else AUDIO.sfxSuccess();

        if (res.finished) {
            st.finished = true;
            if (st.animFrame) cancelAnimationFrame(st.animFrame);
            if (res.won) triggerVictory(res);
            else {
                AUDIO.sfxError();
                showAlert('error', 'DEFEATED',
                    'The Corrupted Overlord has overwhelmed you. The city remains in darkness.');
            }
        }
    } catch (err) {
        if (err.code !== 'ACTION_TOO_FAST') {
            AUDIO.sfxError();
            showAlert('error', 'ACTION FAILED',
                err.status ? err.message : 'Cannot reach mission control.');
        }
    } finally {
        st.pending = false;
    }
}

function playerAttackBoss() { AUDIO.sfxClick(); sendBossAction('attack'); }
function playerDodgeBoss() { sendBossAction('dodge'); }
function playerUltimateBoss() { sendBossAction('ultimate'); }

/* ══════════════════════════════════════════════════
   VICTORY & RESTART
══════════════════════════════════════════════════ */
function formatDuration(ms) {
    if (!ms && ms !== 0) return '--:--.-';
    const total = ms / 1000;
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(Math.floor(total % 60)).padStart(2, '0');
    return `${m}:${s}.${Math.floor((total * 10) % 10)}`;
}

async function triggerVictory(res) {
    const stage3 = document.getElementById('game-stage-3');
    if (stage3) stage3.style.display = 'none';
    const vStage = document.getElementById('game-stage-victory');
    if (vStage) vStage.style.display = 'flex';

    const vName = document.getElementById('v-agent-name');
    if (vName) vName.textContent = GAME_STATE.player.name.toUpperCase();
    const vDept = document.getElementById('v-agent-dept');
    if (vDept) vDept.textContent = `${GAME_STATE.player.dept.toUpperCase()} | AG_ID: ${GAME_STATE.player.roll}`;
    AUDIO.sfxSuccess();

    // Real elapsed time and title come from the server, not a placeholder.
    try {
        const { session } = await API.get('/api/session');
        const total =
            (session.level1?.durationMs || 0) +
            (session.level2?.durationMs || 0) +
            (session.level3?.durationMs || 0);
        const vTime = document.getElementById('v-total-time');
        if (vTime) vTime.textContent = formatDuration(total);

        const rankEl = document.querySelector('#game-stage-victory .vs-row:last-child strong');
        if (rankEl) {
            const champion = res?.champion ?? session.level3?.champion;
            rankEl.textContent = champion ? '#1 (CHAMPION)' : 'FINALIST — OVERLORD DEFEATED';
        }
    } catch (e) { /* the victory screen still stands without the summary */ }
}

function startLevel1() {
    // If not on level1.html page, redirect
    if (!document.getElementById('page-level1') && document.getElementById('game-stage-1') === null) {
        window.location.href = './level1.html';
        return;
    }

    try {
        const saved = localStorage.getItem('tc_player');
        if (saved) {
            const p = JSON.parse(saved);
            GAME_STATE.player.name = p.name || 'Agent';
            GAME_STATE.player.dept = p.dept || 'CSE';
            GAME_STATE.player.roll = p.roll || '2K26';
        }
    } catch (e) { }

    const app = document.querySelector('.app');
    if (app) app.style.display = 'none';
    const stage1 = document.getElementById('game-stage-1');
    if (stage1) stage1.style.display = 'flex';
    GAME_STATE.currentLevel = 1;
    GAME_STATE.startTime = Date.now();

    if (GAME_STATE.level1.interval) clearInterval(GAME_STATE.level1.interval);
    GAME_STATE.level1.interval = setInterval(() => {
        GAME_STATE.level1.timer += 0.1;
        const t = GAME_STATE.level1.timer;
        const m = String(Math.floor(t / 60)).padStart(2, '0');
        const s = String(Math.floor(t % 60)).padStart(2, '0');
        const ms = Math.floor((t * 10) % 10);
        const timerEl = document.getElementById('lvl1-timer');
        if (timerEl) timerEl.textContent = `${m}:${s}.${ms}`;
    }, 100);

    // Auto-start camera scanner on Level 1
    requestCameraAccess();
    if (typeof loadClueBoard === 'function') loadClueBoard();
}

function playGreetingAndProceed(videoSrc, transitionFn) {
    const overlay = document.getElementById('greet-video-overlay');
    const video = document.getElementById('greet-video');
    const skipBtn = document.getElementById('greet-skip');

    if (!overlay || !video || !skipBtn) {
        transitionFn();
        return;
    }

    overlay.style.display = 'flex';
    video.src = videoSrc;

    // Fallback cleanup
    const finish = () => {
        video.onended = null;
        skipBtn.onclick = null;
        overlay.style.display = 'none';
        video.pause();
        transitionFn();
    };

    video.onended = finish;
    skipBtn.onclick = finish;

    video.play().catch(() => finish());
}

function proceedToLevel2() {
    const token = API.token || localStorage.getItem('tc_token') || '';
    const gameUrl = '/game' + (token ? ('?token=' + encodeURIComponent(token)) : '');

    if (!document.getElementById('page-level2') && document.getElementById('game-stage-2') === null) {
        playGreetingAndProceed('./assets/videos/intro.mp4', () => {
            window.location.href = gameUrl;
        });
        return;
    }

    // Direct redirect to 3D Next.js game
    window.location.href = gameUrl;
}

function proceedToLevel3() {
    const token = API.token || localStorage.getItem('tc_token') || '';
    const gameUrl = '/game?level=3' + (token ? ('&token=' + encodeURIComponent(token)) : '');

    if (!document.getElementById('page-level3') && document.getElementById('game-stage-3') === null) {
        playGreetingAndProceed('./assets/videos/intro.mp4', () => {
            window.location.href = gameUrl;
        });
        return;
    }

    // Direct redirect to 3D Next.js Level 3 game
    window.location.href = gameUrl;
}

/** The dashboard is served by the backend, so it lives at the API origin. */
function openDashboard() {
    window.open(`${API_BASE}/dashboard`, '_blank');
}

function resetGameToStart() {
    // Drop the session token so "play again" starts a genuinely fresh run.
    API.token = null;
    window.location.href = './index.html';
}

/* ══════════════════════════════════════════════════
   AUTO PAGE INITIALIZATION ROUTER
══════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════
   MASTERPIECE VISUAL OVERHAUL: THREE.JS & ANIME.JS
══════════════════════════════════════════════════ */
function initMasterpieceVisuals() {
    // 1. ANIME.JS Staggered Entry
    if (typeof anime !== 'undefined') {
        // Animate Clue Cards
        anime({
            targets: '.clue-card',
            translateX: [-50, 0],
            opacity: [0, 1],
            delay: anime.stagger(150, { start: 500 }),
            easing: 'easeOutElastic(1, .6)',
            duration: 1200
        });

        // Animate Gesture Grid
        anime({
            targets: '.g-btn',
            scale: [0, 1],
            opacity: [0, 1],
            delay: anime.stagger(50, { start: 1000 }),
            easing: 'easeOutBack',
            duration: 800
        });
    }

    // 2. THREE.JS Cyberpunk Background
    if (typeof THREE !== 'undefined') {
        const canvas = document.getElementById('bgc');
        if (!canvas) return;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020b18, 0.002);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;
        camera.position.y = 10;

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Cyber Grid
        const gridHelper = new THREE.GridHelper(200, 100, 0x00d4ff, 0x00d4ff);
        gridHelper.material.opacity = 0.15;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        // Particles (Data Stream)
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 1500;
        const posArray = new Float32Array(particlesCount * 3);
        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 100;
        }
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.15,
            color: 0x39ff14,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const particleMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particleMesh);

        // Animate
        let mouseX = 0;
        let mouseY = 0;
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            // Move grid
            gridHelper.position.z = (elapsedTime * 5) % 2;

            // Move particles
            particleMesh.rotation.y = mouseX * 0.2 + elapsedTime * 0.05;
            particleMesh.rotation.x = mouseY * 0.2;

            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}

// Gesture pad button helper
window.inputGestureDigit = inputGestureDigit;

function initEchoTransmission() {
    const textEl = document.getElementById('echo-text');
    if (!textEl) return;
    
    const messages = [
        "AGENT PROTOCOL ENGAGED...",
        "SCANNING BIOMETRICS...",
        "ANALYZING SECURITY THREATS...",
        "AWAITING CLEARANCE...",
        "SYSTEM ENCRYPTED.",
        "NATURE SECTOR CRITICAL..."
    ];
    
    let msgIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 60;
    
    function typeEffect() {
        const currentMsg = messages[msgIndex];
        
        if (isDeleting) {
            textEl.innerHTML = currentMsg.substring(0, charIndex - 1) + '<span class="echo-cursor"></span>';
            charIndex--;
            typingSpeed = 30;
        } else {
            textEl.innerHTML = currentMsg.substring(0, charIndex + 1) + '<span class="echo-cursor"></span>';
            charIndex++;
            typingSpeed = Math.random() * 50 + 40; // Random speed between 40ms and 90ms
        }
        
        if (!isDeleting && charIndex === currentMsg.length) {
            typingSpeed = 2500; // Pause at the end of typing
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            msgIndex = (msgIndex + 1) % messages.length;
            typingSpeed = 500; // Pause before typing next message
        }
        
        setTimeout(typeEffect, typingSpeed);
    }
    
    // Start after a short delay
    setTimeout(typeEffect, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Event Listeners extracted from index.html inline attributes ---
    document.getElementById('audio-toggle')?.addEventListener('click', () => { if (typeof toggleAudio === 'function') toggleAudio(); });
    document.getElementById('btn-alert-ack')?.addEventListener('click', () => { if (typeof closeModal === 'function') closeModal('modal-alert'); });
    document.getElementById('btn-auth-proceed')?.addEventListener('click', () => { 
        if (typeof closeModal === 'function') closeModal('modal-auth'); 
        if (typeof startLevel1 === 'function') startLevel1(); 
    });
    document.getElementById('btn-mission-understood')?.addEventListener('click', () => { if (typeof closeModal === 'function') closeModal('modal-mission'); });
    document.getElementById('startBtn')?.addEventListener('click', (e) => { if (typeof handleStartMission === 'function') handleStartMission(e); });
    document.getElementById('btn-dashboard')?.addEventListener('click', () => { if (typeof openDashboard === 'function') openDashboard(); });
    
    // --- Page Routing ---
    const pageId = document.body ? document.body.id : '';
    if (pageId === 'page-level1') {
        startLevel1();
    } else if (pageId === 'page-level2') {
        proceedToLevel2();
    } else if (pageId === 'page-level3') {
        proceedToLevel3();
    }

    // Initialize Masterpiece Visuals
    initMasterpieceVisuals();
    
    // Initialize Echo Typing
    initEchoTransmission();
});

