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
    dot.style.pointerEvents = 'none';
    const ring = document.createElement('div');
    ring.id = 'vfx-cursor-ring';
    ring.style.pointerEvents = 'none';
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
function runAuthSequence(name, roll, dept, yr, currentLvl = 1) {
    try {
        localStorage.setItem('tc_player', JSON.stringify({
            name, roll, dept, year: yr, currentLvl,
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
    if (currentLvl > 1) {
        lines.splice(6, 1, { t: `> EXISTING SESSION DETECTED. RESTORING TO SECTOR 0${currentLvl}…`, cls: 'ok', d: 2700 });
    }
    lines.forEach(({ t, cls, d }) => {
        setTimeout(() => {
            const s = document.createElement('span'); s.className = 'auth-line ' + cls; s.textContent = t;
            term.appendChild(s); term.scrollTop = term.scrollHeight;
        }, d);
    });

    // Auto-redirect to level after auth animation completes if user doesn't click manually
    setTimeout(() => {
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/Frontend/')) {
            if (currentLvl === 2 && typeof proceedToLevel2 === 'function') proceedToLevel2();
            else if (currentLvl === 3 && typeof proceedToLevel3 === 'function') proceedToLevel3();
            else if (typeof startLevel1 === 'function') startLevel1();
        }
    }, 4000);
}

/* ══════════════════════════════
   ROOM MANAGER — 4 PLAYER TOURNAMENT
══════════════════════════════ */
let roomMode = 'CREATE'; // 'CREATE' or 'JOIN'
let activeRoom = null;
let roomSyncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('vt_room_channel') : null;
let firestoreUnsub = null;

function normalizeRoomCode(raw) {
    if (!raw) return '';
    let clean = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (/^\d{4}$/.test(clean)) clean = 'VT-' + clean;
    if (/^[A-Z0-9]{4}$/.test(clean) && !clean.startsWith('VT-')) clean = 'VT-' + clean;
    return clean;
}

async function fetchRoomData(code) {
    const norm = normalizeRoomCode(code);
    if (!norm) return null;

    try {
        const local = localStorage.getItem('vt_room_' + norm);
        if (local) return JSON.parse(local);
    } catch (e) {}

    const fs = window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    if (fs) {
        try {
            const doc = await fs.collection('vt_rooms').doc(norm).get();
            if (doc.exists) {
                const data = doc.data();
                try { localStorage.setItem('vt_room_' + norm, JSON.stringify(data)); } catch(e) {}
                return data;
            }
        } catch (fbErr) {
            console.warn('[Firebase] Room lookup error:', fbErr);
        }
    }
    return null;
}

function subscribeToRoom(code) {
    const norm = normalizeRoomCode(code);
    if (!norm) return;

    const fs = window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    if (fs) {
        if (firestoreUnsub) firestoreUnsub();
        try {
            firestoreUnsub = fs.collection('vt_rooms').doc(norm).onSnapshot(snapshot => {
                if (snapshot && snapshot.exists) {
                    const room = snapshot.data();
                    activeRoom = room;
                    try { localStorage.setItem('vt_room_' + norm, JSON.stringify(room)); } catch(e) {}
                    updateLobbySlots(room);
                    if (room.status === 'LEVEL1' && !window.location.pathname.endsWith('level1.html')) {
                        window.location.href = './level1.html';
                    }
                }
            });
        } catch (e) {}
    }
}

function setRoomMode(mode) {
    roomMode = mode;
    const btnCreate = document.getElementById('btn-mode-create');
    const btnJoin = document.getElementById('btn-mode-join');
    const fgRoomCode = document.getElementById('fg-room-code');

    if (typeof AUDIO !== 'undefined' && AUDIO.sfxClick) AUDIO.sfxClick();

    if (mode === 'JOIN') {
        if (btnJoin) {
            btnJoin.style.background = 'rgba(0,240,255,0.25)';
            btnJoin.style.borderColor = '#00f0ff';
            btnJoin.style.color = '#00f0ff';
            btnJoin.style.boxShadow = '0 0 15px rgba(0,240,255,0.4)';
        }
        if (btnCreate) {
            btnCreate.style.background = 'rgba(255,255,255,0.05)';
            btnCreate.style.borderColor = '#444';
            btnCreate.style.color = '#aaa';
            btnCreate.style.boxShadow = 'none';
        }
        if (fgRoomCode) fgRoomCode.style.display = 'block';
        setTimeout(() => document.getElementById('joinRoomCode')?.focus(), 50);
    } else {
        if (btnCreate) {
            btnCreate.style.background = 'rgba(0,240,255,0.25)';
            btnCreate.style.borderColor = '#00f0ff';
            btnCreate.style.color = '#00f0ff';
            btnCreate.style.boxShadow = '0 0 15px rgba(0,240,255,0.4)';
        }
        if (btnJoin) {
            btnJoin.style.background = 'rgba(255,255,255,0.05)';
            btnJoin.style.borderColor = '#444';
            btnJoin.style.color = '#aaa';
            btnJoin.style.boxShadow = 'none';
        }
        if (fgRoomCode) fgRoomCode.style.display = 'none';
    }
}
window.setRoomMode = setRoomMode;

function initRoomUI() {
    const btnCreate = document.getElementById('btn-mode-create');
    const btnJoin = document.getElementById('btn-mode-join');

    btnCreate?.addEventListener('click', () => setRoomMode('CREATE'));
    btnJoin?.addEventListener('click', () => setRoomMode('JOIN'));

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
        if (activeRoom && activeRoom.roomCode) {
            navigator.clipboard?.writeText(activeRoom.roomCode);
            showAlert('success', 'ROOM CODE COPIED', `Code ${activeRoom.roomCode} copied to clipboard!`);
        }
    });

    document.getElementById('btn-start-tournament')?.addEventListener('click', () => {
        if (!activeRoom) return;
        activeRoom.status = 'LEVEL1';
        saveAndBroadcastRoom(activeRoom);
        window.location.href = './level1.html';
    });

    if (roomSyncChannel) {
        roomSyncChannel.onmessage = (e) => {
            if (e.data && e.data.roomCode && activeRoom && e.data.roomCode === activeRoom.roomCode) {
                activeRoom = e.data;
                updateLobbySlots(activeRoom);
                if (activeRoom.status === 'LEVEL1' && !window.location.pathname.endsWith('level1.html')) {
                    window.location.href = './level1.html';
                }
            }
        };
    }

    // Polling fallback
    setInterval(async () => {
        if (activeRoom && activeRoom.roomCode) {
            const fresh = await fetchRoomData(activeRoom.roomCode);
            if (fresh) {
                activeRoom = fresh;
                updateLobbySlots(activeRoom);
                if (activeRoom.status === 'LEVEL1' && !window.location.pathname.endsWith('level1.html')) {
                    window.location.href = './level1.html';
                }
            }
        }
    }, 1200);
}

function getStoredRoom(code) {
    const norm = normalizeRoomCode(code);
    try {
        const data = localStorage.getItem('vt_room_' + norm);
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
}

function saveAndBroadcastRoom(room) {
    if (!room || !room.roomCode) return;
    const norm = normalizeRoomCode(room.roomCode);
    room.roomCode = norm;
    try {
        localStorage.setItem('vt_room_' + norm, JSON.stringify(room));
        localStorage.setItem('vt_current_room', JSON.stringify(room));
        if (roomSyncChannel) roomSyncChannel.postMessage(room);

        const fs = window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
        if (fs) {
            fs.collection('vt_rooms').doc(norm).set(room, { merge: true }).catch(() => {});
        }
    } catch (e) {}
}

function updateLobbySlots(room) {
    if (!room) return;
    const codeBadge = document.getElementById('room-code-badge');
    if (codeBadge) codeBadge.textContent = 'CODE: ' + room.roomCode;

    for (let i = 1; i <= 4; i++) {
        const slotEl = document.getElementById('slot-p' + i);
        const nameEl = document.getElementById('p' + i + '-name');
        const statusEl = document.getElementById('p' + i + '-status');

        const player = (room.players || []).find(p => p.slot === i);
        if (player) {
            if (slotEl) {
                slotEl.style.background = 'rgba(0,240,255,0.12)';
                slotEl.style.borderColor = '#00f0ff';
            }
            if (nameEl) nameEl.textContent = player.name.toUpperCase() + (player.isHost ? ' (HOST)' : '');
            if (statusEl) {
                statusEl.textContent = player.isHost ? 'CONNECTED (HOST)' : 'CONNECTED';
                statusEl.style.color = '#4ade80';
            }
        } else {
            if (slotEl) {
                slotEl.style.background = 'rgba(255,255,255,0.03)';
                slotEl.style.borderColor = '#555';
            }
            if (nameEl) nameEl.textContent = `PLAYER ${i}`;
            if (statusEl) {
                statusEl.textContent = 'WAITING FOR JOIN...';
                statusEl.style.color = '#aaa';
            }
        }
    }
}

/* ══ FORM SUBMIT & START MISSION ══ */
async function handleStartMission(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!validateAll()) { AUDIO.sfxError(); return false; }

    const n = document.getElementById('playerName').value.trim();
    const d = document.getElementById('department').value;
    const y = document.getElementById('year').value;
    const phone = document.getElementById('phone').value.trim();
    const joinCodeInput = document.getElementById('joinRoomCode');
    const rawJoinCode = joinCodeInput ? joinCodeInput.value : '';
    const joinCode = normalizeRoomCode(rawJoinCode);

    if (roomMode === 'JOIN' && (!joinCode || joinCode.length < 4)) {
        AUDIO.sfxError();
        showAlert('error', 'INVALID ROOM CODE', 'Please enter a valid room code (e.g. VT-8921 or 8921)');
        return false;
    }

    AUDIO.sfxSuccess();
    const btn = document.getElementById('startBtn'), label = document.getElementById('btn-label');
    if (btn) btn.disabled = true;
    if (label) label.textContent = 'AUTHENTICATING…';

    try {
        const agId = 'AG-' + Math.floor(1000 + Math.random() * 9000);
        const token = 'agent-' + Date.now();

        let targetCode = joinCode;
        let pSlot = 1;

        if (roomMode === 'CREATE') {
            targetCode = 'VT-' + Math.floor(1000 + Math.random() * 9000);
            activeRoom = {
                roomCode: targetCode,
                status: 'LOBBY',
                players: [
                    { id: 'player-1', slot: 1, name: n, dept: d, isHost: true, level1Time: null, level1Status: 'PENDING', level2Time: null, level2Status: 'PENDING', level3BossTime: null }
                ],
                level1FinishCount: 0,
                level2FinishCount: 0,
                winnerName: null
            };
            pSlot = 1;
        } else {
            let roomData = await fetchRoomData(joinCode);
            if (!roomData) {
                // Generate room if joining offline demo
                roomData = {
                    roomCode: joinCode,
                    status: 'LOBBY',
                    players: [],
                    level1FinishCount: 0,
                    level2FinishCount: 0,
                    winnerName: null
                };
            }
            const existingP = (roomData.players || []).find(p => p.name.toUpperCase() === n.toUpperCase());
            if (existingP) {
                pSlot = existingP.slot;
            } else {
                if (roomData.players.length >= 4) {
                    showAlert('error', 'ROOM FULL', 'This room already has 4 players registered.');
                    return false;
                }
                pSlot = roomData.players.length + 1;
                const newP = { id: 'player-' + pSlot, slot: pSlot, name: n, dept: d, isHost: false, level1Time: null, level1Status: 'PENDING', level2Time: null, level2Status: 'PENDING', level3BossTime: null };
                roomData.players.push(newP);
            }
            activeRoom = roomData;
            targetCode = joinCode;
        }

        saveAndBroadcastRoom(activeRoom);
        subscribeToRoom(targetCode);

        const playerObj = { name: n, roll: agId, dept: d, year: y, phone: phone, currentLvl: 1, roomCode: targetCode, playerSlot: pSlot, playerId: 'player-' + pSlot };
        localStorage.setItem('tc_player', JSON.stringify(playerObj));
        localStorage.setItem('tc_token', token);
        if (typeof API !== 'undefined') API.token = token;

        // Open Room Lobby modal
        updateLobbySlots(activeRoom);
        openModal('modal-room-lobby');
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


/* ══ GLOBE CANVAS ══ (index.html only) */
(function () {
    const cvs = document.getElementById('gc');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.width, H = cvs.height, cx = W / 2, cy = H / 2, R = 78;
    let angle = 0;

    const lats = [], lngs = [];
    for (let la = -70; la <= 70; la += 18) {
        const row = []; for (let lo = 0; lo <= 360; lo += 4) row.push([la, lo]); lats.push(row);
    }
    for (let lo = 0; lo < 360; lo += 18) {
        const col = []; for (let la = -80; la <= 80; la += 4) col.push([la, lo]); lngs.push(col);
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
   MASTERPIECE VISUAL OVERHAUL: THREE.JS & ANIME.JS
══════════════════════════════════════════════════ */
function initMasterpieceVisuals() {
    // 1. ANIME.JS Staggered Entry
    if (typeof anime !== 'undefined') {
        anime({
            targets: '.clue-card',
            translateX: [-50, 0],
            opacity: [0, 1],
            delay: anime.stagger(150, { start: 500 }),
            easing: 'easeOutElastic(1, .6)',
            duration: 1200
        });

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
            gridHelper.position.z = (elapsedTime * 5) % 2;
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
    let typingSpeed = 30;

    function typeEffect() {
        const currentMsg = messages[msgIndex];

        if (isDeleting) {
            textEl.innerHTML = currentMsg.substring(0, charIndex - 1) + '<span class="echo-cursor"></span>';
            charIndex--;
            typingSpeed = 30;
        } else {
            textEl.innerHTML = currentMsg.substring(0, charIndex + 1) + '<span class="echo-cursor"></span>';
            charIndex++;
            typingSpeed = Math.random() * 40 + 30;
        }

        if (!isDeleting && charIndex === currentMsg.length) {
            typingSpeed = 2500;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            msgIndex = (msgIndex + 1) % messages.length;
            typingSpeed = 500;
        }

        setTimeout(typeEffect, typingSpeed);
    }

    setTimeout(typeEffect, 1500);
}

/* ══════════════════════════════════════════════════
   AUTO PAGE INITIALIZATION ROUTER
══════════════════════════════════════════════════ */
function startLevel1() { window.location.href = './level1.html'; }
function proceedToLevel2() {
    const token = localStorage.getItem('tc_token') || '';
    window.location.href = '/game' + (token ? ('?token=' + encodeURIComponent(token)) : '');
}
function proceedToLevel3() {
    const token = localStorage.getItem('tc_token') || '';
    window.location.href = '/game?level=3' + (token ? ('&token=' + encodeURIComponent(token)) : '');
}

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Event Listeners extracted from index.html inline attributes ---
    document.getElementById('audio-toggle')?.addEventListener('click', () => { if (typeof toggleAudio === 'function') toggleAudio(); });
    document.getElementById('btn-alert-ack')?.addEventListener('click', () => { if (typeof closeModal === 'function') closeModal('modal-alert'); });
    document.getElementById('btn-auth-proceed')?.addEventListener('click', () => {
        if (typeof closeModal === 'function') closeModal('modal-auth');
        let lvl = 1;
        try {
            const p = JSON.parse(localStorage.getItem('tc_player'));
            if (p && p.currentLvl) lvl = p.currentLvl;
        } catch (e) { }
        if (lvl === 2 && typeof proceedToLevel2 === 'function') proceedToLevel2();
        else if (lvl === 3 && typeof proceedToLevel3 === 'function') proceedToLevel3();
        else if (typeof startLevel1 === 'function') startLevel1();
    });
    document.getElementById('btn-mission-understood')?.addEventListener('click', () => { if (typeof closeModal === 'function') closeModal('modal-mission'); });
    document.getElementById('startBtn')?.addEventListener('click', (e) => { if (typeof handleStartMission === 'function') handleStartMission(e); });
    document.getElementById('btn-dashboard')?.addEventListener('click', () => { if (typeof openDashboard === 'function') openDashboard(); });

    const pageId = document.body ? document.body.id : '';
    if (pageId === 'page-level1') {
        startLevel1();
    } else if (pageId === 'page-level2') {
        proceedToLevel2();
    } else if (pageId === 'page-level3') {
        proceedToLevel3();
    }

    initMasterpieceVisuals();
    initEchoTransmission();
    if (typeof initRoomUI === 'function') initRoomUI();
});
