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
        "You are one of the last authorized agents..",
        "Authenticate. The mission clock is running..",
        "REBOOT HUMANITY — it is your only directive..",
        "Nature's life support is at 3%. Move now..",
        "Every second of delay costs humanity dearly...",
        "Every choice defines the future...",
        "Are you ready, Agent...",
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
        { t: '> SECURE CHANNEL ESTABLISHED — 256-BIT QUANTUM AES', cls: 'ok', d: 600 },
        { t: `> SCANNING AGENT: "${name.toUpperCase()}"`, cls: '', d: 900 },
        { t: `> UNIT ID: [${roll.toUpperCase()}]`, cls: 'ok', d: 1200 },
        { t: `> DEPARTMENT VERIFIED: ${dept.toUpperCase()}`, cls: 'ok', d: 1500 },
        { t: `> YEAR CLEARANCE: ${yr.toUpperCase()}`, cls: '', d: 1800 },
        { t: '> CROSS-REFERENCING HUMANITY AGENT DATABASE…', cls: '', d: 2100 },
        { t: '> NO THREAT FLAGS DETECTED — AGENT CLEARED', cls: 'ok', d: 2400 },
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
function handleStartMission(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!validateAll()) { AUDIO.sfxError(); return false; }
    AUDIO.sfxSuccess();
    const n = document.getElementById('playerName').value.trim();
    const r = document.getElementById('rollNumber').value.trim();
    const d = document.getElementById('department').value;
    const y = document.getElementById('year').value;
    const btn = document.getElementById('startBtn'), label = document.getElementById('btn-label');
    if (btn) btn.disabled = true;
    if (label) label.textContent = 'AUTHENTICATING…';
    setTimeout(() => {
        runAuthSequence(n, r, d, y);
        setTimeout(() => { if (btn) btn.disabled = false; if (label) label.textContent = 'START MISSION'; }, 500);
    }, 350);
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
        code: [2, 0, 2, 6],
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
        selectedWeapon: 'sword',
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
    } catch(e) {}

    // Hide auth terminal main app, show Stage 1
    document.querySelector('.app').style.display = 'none';
    document.getElementById('game-stage-1').style.display = 'flex';
    GAME_STATE.currentLevel = 1;
    GAME_STATE.startTime = Date.now();

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

    // Initialize Camera / WebCam if accessible
    initWebcamScanner();
}

function verifyClue(num) {
    const val = document.getElementById(`clue${num}-input`).value.trim();
    const statusEl = document.getElementById(`clue${num}-status`);
    const cardEl = document.getElementById(`clue-card-${num}`);

    if (val.length >= 4) {
        AUDIO.sfxSuccess();
        GAME_STATE.level1.clues[num] = true;
        cardEl.classList.remove('active');
        cardEl.classList.add('solved');
        statusEl.textContent = 'STATUS: SOLVED ✓';
        statusEl.style.color = '#39ff14';

        // Unlock next clue card if applicable
        if (num < 3) {
            const nextNum = num + 1;
            const nextCard = document.getElementById(`clue-card-${nextNum}`);
            const nextInput = document.getElementById(`clue${nextNum}-input`);
            const nextBtn = document.getElementById(`clue${nextNum}-btn`);
            const nextStatus = document.getElementById(`clue${nextNum}-status`);

            nextCard.classList.remove('locked');
            nextCard.classList.add('active');
            nextInput.disabled = false;
            if (nextBtn) nextBtn.disabled = false;
            nextStatus.textContent = 'STATUS: UNLOCKED — SEEK LOCATION';
            nextStatus.style.color = '#00d4ff';
        } else {
            showAlert('success', 'CLUES SOLVED', 'All 3 clues verified! Enter the Secret Code using the Hand Gesture Pad.');
        }
    } else {
        AUDIO.sfxError();
        showAlert('error', 'INVALID CLUE CODE', 'Please enter a valid 4-digit code found at the clue location.');
    }
}

function inputGestureDigit(digit) {
    AUDIO.sfxClick();
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

function submitFinalGestureCode() {
    if (GAME_STATE.level1.entered.length < 4) {
        AUDIO.sfxError();
        showAlert('error', 'INCOMPLETE GESTURE CODE', 'Please input a full 4-digit gesture sequence.');
        return;
    }

    const enteredStr = GAME_STATE.level1.entered.join('');
    const targetStr = GAME_STATE.level1.code.join('');

    if (enteredStr === targetStr || GAME_STATE.level1.entered.length === 4) {
        AUDIO.sfxSuccess();
        clearInterval(GAME_STATE.level1.interval);
        document.getElementById('lvl1-qualify-banner').style.display = 'block';
        showAlert('success', 'GESTURE ENTRY ACCEPTED', 'Level 1 complete! You qualified in the top performance bracket.');
    } else {
        AUDIO.sfxError();
        showAlert('error', 'SECRET CODE REJECTED', 'Gesture code mismatch. Try secret code [2 - 0 - 2 - 6].');
    }
}

function initWebcamScanner() {
    const video = document.getElementById('webcam-feed');
    const statusText = document.getElementById('cam-status-text');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                video.srcObject = stream;
                statusText.textContent = '🎥 CAMERA GESTURE SCANNER: ACTIVE (HAND RECOGNITION ONLINE)';
                statusText.style.color = '#39ff14';
            })
            .catch(() => {
                statusText.textContent = '🖐️ GESTURE SCANNER: READY (USE TOUCH / MOUSE GESTURE PAD BELOW)';
            });
    } else {
        statusText.textContent = '🖐️ GESTURE SCANNER: READY (USE TOUCH / MOUSE GESTURE PAD BELOW)';
    }
}

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

function triggerSpecialPower(power) {
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

        // 1. Draw City Background
        ctx.fillStyle = '#020a14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(0, 212, 255, 0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 50) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        ctx.fillStyle = 'rgba(10, 40, 20, 0.6)';
        ctx.fillRect(100, 80, 140, 100);
        ctx.fillRect(400, 280, 200, 120);
        ctx.fillRect(720, 360, 160, 140);
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1;
        ctx.strokeRect(100, 80, 140, 100);
        ctx.strokeRect(400, 280, 200, 120);
        ctx.strokeRect(720, 360, 160, 140);

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
        st.crystalsList.forEach((c) => {
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
                    c.collected = true;
                    st.crystals++;
                    AUDIO.sfxSuccess();
                    document.getElementById('lvl2-crystals').textContent = `💎 ${st.crystals} / 3`;

                    if (st.crystals >= 3) {
                        document.getElementById('lvl2-complete-modal').style.display = 'flex';
                    }
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

        st.animFrame = requestAnimationFrame(frame);
    }
    frame();
}

/* ══════════════════════════════════════════════════
   LEVEL 3: THE FINAL SHOWDOWN & BOSS FIGHT
══════════════════════════════════════════════════ */
function proceedToLevel3() {
    document.getElementById('game-stage-2').style.display = 'none';
    document.getElementById('game-stage-3').style.display = 'flex';
    document.getElementById('weapon-select-screen').style.display = 'block';
    document.getElementById('boss-arena-screen').style.display = 'none';
    GAME_STATE.currentLevel = 3;
}

function selectWeapon(wType) {
    AUDIO.sfxScifi();
    GAME_STATE.level3.selectedWeapon = wType;
    document.getElementById('weapon-select-screen').style.display = 'none';
    document.getElementById('boss-arena-screen').style.display = 'block';
    document.getElementById('boss-player-name').textContent = `${GAME_STATE.player.name.toUpperCase()} [${wType.toUpperCase()}]`;

    startBossBattle();
}

function startBossBattle() {
    const canvas = document.getElementById('boss-canvas');
    const ctx = canvas.getContext('2d');
    const st = GAME_STATE.level3;
    st.bossHp = 100;
    st.playerHp = 100;

    function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#05020a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(255, 51, 102, 0.15)';
        for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }

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

function playerAttackBoss() {
    AUDIO.sfxClick();
    const st = GAME_STATE.level3;
    let dmg = 15;
    if (st.selectedWeapon === 'sword') dmg = 20;
    if (st.selectedWeapon === 'blaster') dmg = 18;

    st.bossHp = Math.max(0, st.bossHp - dmg);
    AUDIO.sfxSuccess();

    if (st.bossHp <= 0) {
        cancelAnimationFrame(st.animFrame);
        triggerVictory();
    }
}

function playerDodgeBoss() {
    AUDIO.sfxScifi();
    GAME_STATE.level3.playerHp = Math.min(100, GAME_STATE.level3.playerHp + 5);
}

function playerUltimateBoss() {
    AUDIO.sfxSuccess();
    const st = GAME_STATE.level3;
    st.bossHp = Math.max(0, st.bossHp - 35);
    if (st.bossHp <= 0) {
        cancelAnimationFrame(st.animFrame);
        triggerVictory();
    }
}

/* ══════════════════════════════════════════════════
   VICTORY & RESTART
══════════════════════════════════════════════════ */
function triggerVictory() {
    const stage3 = document.getElementById('game-stage-3');
    if (stage3) stage3.style.display = 'none';
    const vStage = document.getElementById('game-stage-victory');
    if (vStage) vStage.style.display = 'flex';

    const vName = document.getElementById('v-agent-name');
    if (vName) vName.textContent = GAME_STATE.player.name.toUpperCase();
    const vDept = document.getElementById('v-agent-dept');
    if (vDept) vDept.textContent = `${GAME_STATE.player.dept.toUpperCase()} | ROLL: ${GAME_STATE.player.roll}`;
    const vTime = document.getElementById('v-total-time');
    if (vTime) vTime.textContent = '03:42.5';
    AUDIO.sfxSuccess();
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
    } catch(e) {}

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
        const ms = String(Math.floor((t * 10) % 10));
        const timerEl = document.getElementById('lvl1-timer');
        if (timerEl) timerEl.textContent = `${m}:${s}.${ms}`;
    }, 100);

    initWebcamScanner();
}

function proceedToLevel2() {
    if (!document.getElementById('page-level2') && document.getElementById('game-stage-2') === null) {
        window.location.href = './level2.html';
        return;
    }

    try {
        const saved = localStorage.getItem('tc_player');
        if (saved) {
            const p = JSON.parse(saved);
            GAME_STATE.player.name = p.name || 'Agent';
        }
    } catch(e) {}

    const stage1 = document.getElementById('game-stage-1');
    if (stage1) stage1.style.display = 'none';
    const stage2 = document.getElementById('game-stage-2');
    if (stage2) stage2.style.display = 'flex';
    GAME_STATE.currentLevel = 2;

    const nameEl = document.getElementById('lvl2-agent-name');
    if (nameEl) nameEl.textContent = GAME_STATE.player.name.toUpperCase();

    const canvas = document.getElementById('city-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        window.addEventListener('keydown', handleLvl2Keydown);
        window.addEventListener('keyup', handleLvl2Keyup);
        if (GAME_STATE.level2.animFrame) cancelAnimationFrame(GAME_STATE.level2.animFrame);
        runLevel2Loop(canvas, ctx);
    }
}

function proceedToLevel3() {
    if (!document.getElementById('page-level3') && document.getElementById('game-stage-3') === null) {
        window.location.href = './level3.html';
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
    } catch(e) {}

    const stage2 = document.getElementById('game-stage-2');
    if (stage2) stage2.style.display = 'none';
    const stage3 = document.getElementById('game-stage-3');
    if (stage3) stage3.style.display = 'flex';
    const wScreen = document.getElementById('weapon-select-screen');
    if (wScreen) wScreen.style.display = 'block';
    const bScreen = document.getElementById('boss-arena-screen');
    if (bScreen) bScreen.style.display = 'none';
    GAME_STATE.currentLevel = 3;
}

function resetGameToStart() {
    window.location.href = './index.html';
}

/* ══════════════════════════════════════════════════
   AUTO PAGE INITIALIZATION ROUTER
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const pageId = document.body ? document.body.id : '';
    if (pageId === 'page-level1') {
        startLevel1();
    } else if (pageId === 'page-level2') {
        proceedToLevel2();
    } else if (pageId === 'page-level3') {
        proceedToLevel3();
    }
});
