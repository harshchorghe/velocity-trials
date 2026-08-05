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

/* ══ CURSOR ══ */
(function () {
    const g = document.getElementById('cursor-glow');
    document.addEventListener('mousemove', e => { g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px' });
    document.addEventListener('mouseenter', () => g.style.opacity = '1');
    document.addEventListener('mouseleave', () => g.style.opacity = '0');
    document.querySelectorAll('button,input,select,label,[onclick]').forEach(el => {
        el.addEventListener('mouseenter', () => { document.body.classList.add('hovering'); AUDIO.sfxHover(); });
        el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
    });
})();

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

/* ══ INTRO VIDEO SEQUENCE ══ */
(function () {
    const intro = document.getElementById('intro-screen');
    const vid = document.getElementById('intro-video');
    const pfill = document.getElementById('intro-pfill');
    const skip = document.getElementById('intro-skip');
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
        { t: '> ECHO KERNEL v4.2 — INITIALIZING…', cls: '', pct: 8, d: 0 },
        { t: '> LOADING MISSION DATABASE…', cls: '', pct: 18, d: 420 },
        { t: '> QUANTUM ENCRYPTION MODULE: ONLINE', cls: 'ok', pct: 30, d: 860 },
        { t: '> SCANNING ARIA THREAT VECTORS…', cls: 'warn', pct: 42, d: 1300 },
        { t: '> WARNING: 1,847 BREACH POINTS DETECTED', cls: 'warn', pct: 48, d: 1700 },
        { t: '> CALIBRATING AGENT AUTHENTICATION GRID…', cls: '', pct: 58, d: 2200 },
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

/* ══ NAV BUTTONS ══ */
document.getElementById('btn-briefing').addEventListener('click', () => { AUDIO.sfxScifi(); openModal('modal-mission'); });
document.getElementById('btn-leaderboard').addEventListener('click', () => { AUDIO.sfxScifi(); openModal('modal-leaderboard'); });
document.getElementById('btn-exit').addEventListener('click', () => { AUDIO.sfxError(); exitSystem(); });
document.getElementById('rules-link').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openModal('modal-mission') });

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

/* ══ ECHO AI TYPEWRITER ══ */
(function () {
    const msgs = [
        "Scanning global threat matrix…",
        "AI containment breach at 04:17 UTC.",
        "You are one of the last authorized agents.",
        "Authenticate. The mission clock is running.",
        "REBOOT HUMANITY — it is your only directive.",
        "Nature's life support is at 3%. Move now.",
        "Every second of delay costs humanity dearly.",
        "Every choice defines the future.",
        "Are you ready, Agent?",
    ];
    const el = document.getElementById('echo-text');
    let mi = 0, ci = 0, typing = true;
    function tick() {
        const msg = msgs[mi];
        if (typing) {
            ci++; el.innerHTML = msg.slice(0, ci) + '<span class="echo-cursor"></span>';
            if (ci >= msg.length) { typing = false; setTimeout(tick, 2600); return; }
            setTimeout(tick, 38 + Math.random() * 22);
        } else {
            ci--; el.innerHTML = msg.slice(0, ci) + '<span class="echo-cursor"></span>';
            if (ci <= 0) { typing = true; mi = (mi + 1) % msgs.length; setTimeout(tick, 400); return; }
            setTimeout(tick, 14);
        }
    }
    setTimeout(tick, 6500);
})();

/* ══ COUNTDOWN TIMER ══ */
(function () {
    const el = document.getElementById('stat-timer');
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
        v('rollNumber').length > 0,
        v('department') !== '',
        v('year') !== '',
        /^[6-9]\d{9}$/.test(v('phone')),
        document.getElementById('agree').checked,
    ];
    const pct = Math.round(checks.filter(Boolean).length / checks.length * 100);
    document.getElementById('fp-fill').style.width = pct + '%';
    document.getElementById('fp-pct').textContent = pct + '%';
}
['playerName', 'rollNumber', 'phone'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { updateProgress(); AUDIO.sfxType(); });
});
['department', 'year'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { updateProgress(); AUDIO.sfxClick(); });
});
document.getElementById('agree').addEventListener('change', updateProgress);

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
        case 'rollNumber': return setField('rollNumber', 'err-roll', v.length > 0);
        case 'department': return setField('department', 'err-dept', v !== '');
        case 'year': return setField('year', 'err-year', v !== '');
        case 'phone': return setField('phone', 'err-phone', /^[6-9]\d{9}$/.test(v));
    }
}
['playerName', 'rollNumber', 'phone'].forEach(id => {
    document.getElementById(id).addEventListener('blur', () => validateField(id));
    document.getElementById(id).addEventListener('input', () => {
        if (document.getElementById(id).classList.contains('err')) validateField(id);
        updateProgress();
    });
});
['department', 'year'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { validateField(id); updateProgress(); });
});
document.getElementById('phone').addEventListener('keypress', e => { if (!/[0-9]/.test(e.key)) e.preventDefault() });

function validateAll() {
    const r = ['playerName', 'rollNumber', 'department', 'year', 'phone'].map(id => validateField(id));
    const chkWrap = document.getElementById('chk-wrap'), agreed = document.getElementById('agree').checked;
    chkWrap.classList.toggle('err', !agreed);
    if (!agreed) { chkWrap.classList.add('shake'); setTimeout(() => chkWrap.classList.remove('shake'), 320); }
    return r.every(Boolean) && agreed;
}

/* ══ AUTH SEQUENCE ══ */
function runAuthSequence(name, roll, dept, yr) {
    openModal('modal-auth');
    const term = document.getElementById('auth-terminal'), action = document.getElementById('auth-action');
    term.innerHTML = ''; action.style.display = 'none';
    const lines = [
        { t: '> INITIALIZING ECHO AUTHENTICATION PROTOCOL v4.2…', cls: '', d: 0 },
        { t: '> CONNECTING TO MISSION CONTROL SERVER…', cls: '', d: 550 },
        { t: '> SECURE CHANNEL ESTABLISHED — 256-BIT QUANTUM AES', cls: 'ok', d: 1150 },
        { t: `> SCANNING AGENT: "${name.toUpperCase()}"`, cls: '', d: 1800 },
        { t: `> UNIT ID: [${roll.toUpperCase()}]`, cls: 'ok', d: 2400 },
        { t: `> DEPARTMENT VERIFIED: ${dept.toUpperCase()}`, cls: 'ok', d: 2900 },
        { t: `> YEAR CLEARANCE: ${yr.toUpperCase()}`, cls: '', d: 3350 },
        { t: '> CROSS-REFERENCING HUMANITY AGENT DATABASE…', cls: '', d: 3850 },
        { t: '> NO THREAT FLAGS DETECTED — AGENT CLEARED', cls: 'ok', d: 4700 },
        { t: '> ASSIGNING MISSION COORDINATES & ZONE ACCESS…', cls: '', d: 5300 },
        { t: '> ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%', cls: '', d: 6000 },
        { t: '', cls: 'blank', d: 6400 },
        { t: `✦ MISSION AUTHORIZED · WELCOME AGENT ${name.toUpperCase()} ✦`, cls: 'hi', d: 6800 },
    ];
    lines.forEach(({ t, cls, d }) => {
        setTimeout(() => {
            const s = document.createElement('span'); s.className = 'auth-line ' + cls; s.textContent = t;
            term.appendChild(s); term.scrollTop = term.scrollHeight;
        }, d);
    });
    setTimeout(() => {
        action.style.display = 'block';
        try { localStorage.setItem('tc_player', JSON.stringify({ name, roll, dept, year: yr, phone: document.getElementById('phone').value.trim(), ts: Date.now() })); } catch (e) { }
    }, 7800);
}

/* ══ FORM SUBMIT ══ */
document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateAll()) { AUDIO.sfxError(); return; }
    AUDIO.sfxSuccess();
    const n = document.getElementById('playerName').value.trim();
    const r = document.getElementById('rollNumber').value.trim();
    const d = document.getElementById('department').value;
    const y = document.getElementById('year').value;
    const btn = document.getElementById('startBtn'), label = document.getElementById('btn-label');
    btn.disabled = true; label.textContent = 'AUTHENTICATING…';
    setTimeout(() => {
        runAuthSequence(n, r, d, y);
        setTimeout(() => { btn.disabled = false; label.textContent = 'START MISSION'; }, 500);
    }, 350);
});

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

/* ══ GLOBE CANVAS ══ */
(function () {
    const cvs = document.getElementById('gc'), ctx = cvs.getContext('2d');
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