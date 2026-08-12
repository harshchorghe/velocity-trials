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
    const noop = () => {};
    return {
        start: noop,
        toggle: () => false,
        sfxClick: noop,
        sfxHover: noop,
        sfxType: noop,
        sfxSuccess: noop,
        sfxError: noop,
        sfxBoot: noop,
        sfxScifi: noop
    };
})();

function toggleAudio() {}

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
    if (!intro || !vid || !pfill || !skip) {
        if (typeof startBoot === 'function') startBoot();
        return;
    }
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
let sessionPlayer = null;

function getLocalPlayer() {
    if (sessionPlayer) return sessionPlayer;
    try {
        const ses = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tc_player_session') : null;
        if (ses) {
            sessionPlayer = JSON.parse(ses);
            return sessionPlayer;
        }
    } catch(e) {}
    try {
        const local = typeof localStorage !== 'undefined' ? localStorage.getItem('tc_player') : null;
        if (local) {
            sessionPlayer = JSON.parse(local);
            return sessionPlayer;
        }
    } catch(e) {}
    return null;
}

// Multi-Tab Local Storage Cross-Tab Listener
window.addEventListener('storage', (e) => {
    if (!e.newValue) return;
    if (e.key === 'vt_current_room' || (e.key && e.key.startsWith('vt_room_'))) {
        try {
            const room = JSON.parse(e.newValue);
            const curP = getLocalPlayer();
            if (room && room.roomCode) {
                const myCode = curP && curP.roomCode ? normalizeRoomCode(curP.roomCode) : (activeRoom ? normalizeRoomCode(activeRoom.roomCode) : '');
                if (!myCode || normalizeRoomCode(room.roomCode) === myCode) {
                    activeRoom = room;
                    updateLobbySlots(room);
                    checkAndRedirectLevel1(room);
                }
            }
        } catch(err) {}
    }
});

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

    // Check Firebase Firestore first for live cross-device accuracy
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

    try {
        const local = localStorage.getItem('vt_room_' + norm);
        if (local) return JSON.parse(local);
    } catch (e) {}

    return null;
}

function checkAndRedirectLevel1(room) {
    if (!room || room.status !== 'LEVEL1') return;
    const path = window.location.pathname || '';
    if (!path.includes('level1')) {
        console.log('[RoomSync] LEVEL1 status active! Redirecting to Level 1...');
        window.location.href = './level1.html';
    }
}

function subscribeToRoom(code) {
    const norm = normalizeRoomCode(code);
    if (!norm) return;

    const fs = window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    if (fs) {
        if (firestoreUnsub) {
            try { firestoreUnsub(); } catch(e) {}
        }
        try {
            console.log('[subscribeToRoom] Subscribing to Firestore room:', norm);
            firestoreUnsub = fs.collection('vt_rooms').doc(norm).onSnapshot(snapshot => {
                if (snapshot && snapshot.exists) {
                    const room = snapshot.data();
                    activeRoom = room;
                    try { localStorage.setItem('vt_room_' + norm, JSON.stringify(room)); } catch(e) {}
                    try { localStorage.setItem('vt_current_room', JSON.stringify(room)); } catch(e) {}
                    updateLobbySlots(room);
                    checkAndRedirectLevel1(room);
                }
            }, err => {
                console.warn('[subscribeToRoom] Snapshot error:', err);
            });
        } catch (e) {
            console.error('[subscribeToRoom] Error:', e);
        }
    }
}

async function saveAndBroadcastRoom(room) {
    if (!room || !room.roomCode) return;
    const norm = normalizeRoomCode(room.roomCode);
    room.roomCode = norm;

    // Convert to clean JSON object stripping undefined fields that cause Firestore errors
    const cleanRoom = JSON.parse(JSON.stringify(room));
    cleanRoom.roomCode = norm;

    try {
        localStorage.setItem('vt_room_' + norm, JSON.stringify(cleanRoom));
        localStorage.setItem('vt_current_room', JSON.stringify(cleanRoom));
        if (roomSyncChannel) roomSyncChannel.postMessage(cleanRoom);

        const fs = window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
        if (fs) {
            await fs.collection('vt_rooms').doc(norm).set(cleanRoom, { merge: true });
            console.log('[saveAndBroadcastRoom] Firestore write SUCCESS:', norm, cleanRoom.status);
        }
    } catch (e) {
        console.error('[saveAndBroadcastRoom] Firestore error:', e);
    }
}

async function startTournamentGame() {
    let p = getLocalPlayer();
    let code = (activeRoom && activeRoom.roomCode) || (p && p.roomCode);
    if (!code) {
        try {
            const cur = localStorage.getItem('vt_current_room');
            if (cur) {
                const parsed = JSON.parse(cur);
                if (parsed && parsed.roomCode) code = parsed.roomCode;
            }
        } catch(e) {}
    }
    if (!code) code = 'VT-8921';

    // Fetch fresh room data from Firestore first so we preserve all 4 players!
    let room = await fetchRoomData(code);
    if (!room) room = activeRoom;
    if (!room) {
        room = {
            roomCode: code,
            status: 'LOBBY',
            players: [{ id: 'player-1', slot: 1, name: (p && p.name) || 'HOST', isHost: true }]
        };
    }

    room.status = 'LEVEL1';
    activeRoom = room;

    await saveAndBroadcastRoom(room);

    if (typeof AUDIO !== 'undefined' && AUDIO.sfxSuccess) AUDIO.sfxSuccess();

    window.location.href = './level1.html';
}
window.startTournamentGame = startTournamentGame;

function initRoomUI() {
    const curP = getLocalPlayer();
    if (curP && curP.roomCode) {
        subscribeToRoom(curP.roomCode);
    }

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
        if (activeRoom && activeRoom.roomCode) {
            navigator.clipboard?.writeText(activeRoom.roomCode);
            showAlert('success', 'ROOM CODE COPIED', `Code ${activeRoom.roomCode} copied to clipboard!`);
        }
    });

    document.getElementById('btn-start-tournament')?.addEventListener('click', async (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        await startTournamentGame();
    });

    document.getElementById('btn-force-start')?.addEventListener('click', async (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        await startTournamentGame();
    });

    if (roomSyncChannel) {
        roomSyncChannel.onmessage = (e) => {
            if (e.data && e.data.roomCode) {
                const p = getLocalPlayer();
                const roomCodeMatch = p && p.roomCode && normalizeRoomCode(e.data.roomCode) === normalizeRoomCode(p.roomCode);
                if (roomCodeMatch || (activeRoom && e.data.roomCode === activeRoom.roomCode)) {
                    activeRoom = e.data;
                    updateLobbySlots(activeRoom);
                    checkAndRedirectLevel1(activeRoom);
                }
            }
        };
    }

    // Polling fallback every 400ms for instant real-time reaction
    setInterval(async () => {
        const p = getLocalPlayer();
        const codeToPoll = (activeRoom && activeRoom.roomCode) || (p && p.roomCode);
        if (codeToPoll) {
            const fresh = await fetchRoomData(codeToPoll);
            if (fresh) {
                activeRoom = fresh;
                updateLobbySlots(activeRoom);
                checkAndRedirectLevel1(activeRoom);
            }
        }
    }, 400);
}

function switchCardMode(mode) {
    roomMode = mode;
    const tabCreate = document.getElementById('tab-btn-create');
    const tabJoin = document.getElementById('tab-btn-join');
    const cardCreate = document.getElementById('card-create-team');
    const cardJoin = document.getElementById('card-join-team');

    if (typeof AUDIO !== 'undefined' && AUDIO.sfxClick) AUDIO.sfxClick();

    if (mode === 'JOIN') {
        if (tabJoin) {
            tabJoin.classList.add('active');
            tabJoin.style.background = 'rgba(0,240,255,0.25)';
            tabJoin.style.borderColor = '#00f0ff';
            tabJoin.style.color = '#00f0ff';
            tabJoin.style.boxShadow = '0 0 15px rgba(0,240,255,0.4)';
        }
        if (tabCreate) {
            tabCreate.classList.remove('active');
            tabCreate.style.background = 'rgba(255,255,255,0.08)';
            tabCreate.style.borderColor = '#555';
            tabCreate.style.color = '#fff';
            tabCreate.style.boxShadow = 'none';
        }
        if (cardCreate) cardCreate.style.display = 'none';
        if (cardJoin) cardJoin.style.display = 'block';
        setTimeout(() => document.getElementById('joinRoomCode')?.focus(), 50);
    } else {
        if (tabCreate) {
            tabCreate.classList.add('active');
            tabCreate.style.background = 'rgba(0,240,255,0.25)';
            tabCreate.style.borderColor = '#00f0ff';
            tabCreate.style.color = '#00f0ff';
            tabCreate.style.boxShadow = '0 0 15px rgba(0,240,255,0.4)';
        }
        if (tabJoin) {
            tabJoin.classList.remove('active');
            tabJoin.style.background = 'rgba(255,255,255,0.08)';
            tabJoin.style.borderColor = '#555';
            tabJoin.style.color = '#fff';
            tabJoin.style.boxShadow = 'none';
        }
        if (cardJoin) cardJoin.style.display = 'none';
        if (cardCreate) cardCreate.style.display = 'block';
    }
}
window.switchCardMode = switchCardMode;
window.setRoomMode = switchCardMode;

async function handleFindTeam() {
    const input = document.getElementById('joinRoomCode');
    const errEl = document.getElementById('err-find-team');
    const previewBox = document.getElementById('team-preview-box');
    const joinForm = document.getElementById('joinTeamForm');

    const code = normalizeRoomCode(input ? input.value : '');
    if (!code || code.length < 4) {
        if (errEl) {
            errEl.textContent = '⚠ PLEASE ENTER A VALID 6-CHAR TEAM CODE (e.g. VT-8921)';
            errEl.style.display = 'block';
        }
        if (previewBox) previewBox.style.display = 'none';
        if (joinForm) joinForm.style.display = 'none';
        return;
    }

    if (typeof AUDIO !== 'undefined' && AUDIO.sfxClick) AUDIO.sfxClick();

    const room = await fetchRoomData(code);
    if (!room) {
        if (errEl) {
            errEl.textContent = `⚠ NO TEAM FOUND WITH CODE "${code}". PLEASE CHECK AND RETRY.`;
            errEl.style.display = 'block';
        }
        if (previewBox) previewBox.style.display = 'none';
        if (joinForm) joinForm.style.display = 'none';
        return;
    }

    if (errEl) errEl.style.display = 'none';

    const host = (room.players || []).find(p => p.isHost) || (room.players ? room.players[0] : null);
    const joinedCount = (room.players || []).length;
    const isFull = joinedCount >= 4;

    const previewCode = document.getElementById('preview-team-code');
    const previewStatus = document.getElementById('preview-slots-status');
    const previewHost = document.getElementById('preview-host-name');
    const previewMembers = document.getElementById('preview-members-list');

    if (previewCode) previewCode.textContent = 'CODE: ' + room.roomCode;
    if (previewStatus) {
        if (isFull) {
            previewStatus.textContent = 'ROOM FULL (4/4)';
            previewStatus.style.background = '#ef4444';
            previewStatus.style.color = '#fff';
        } else {
            previewStatus.textContent = `AVAILABLE (${joinedCount}/4 JOINED)`;
            previewStatus.style.background = '#4ade80';
            previewStatus.style.color = '#000';
        }
    }
    if (previewHost) previewHost.textContent = '👑 HOST: ' + (host ? host.name.toUpperCase() : 'UNKNOWN');
    if (previewMembers) {
        const names = (room.players || []).map(p => p.name + (p.isHost ? ' (Host)' : '')).join(', ');
        previewMembers.textContent = 'Current Squad: ' + (names || 'None');
    }

    if (previewBox) previewBox.style.display = 'block';

    if (isFull) {
        if (joinForm) joinForm.style.display = 'none';
        showAlert('error', 'TEAM FULL', `Team ${room.roomCode} already has 4 players registered.`);
    } else {
        if (joinForm) joinForm.style.display = 'block';
    }
}
window.handleFindTeam = handleFindTeam;

function getLocalPlayer() {
    if (sessionPlayer) return sessionPlayer;
    try {
        const sess = sessionStorage.getItem('tc_player_session');
        if (sess) {
            sessionPlayer = JSON.parse(sess);
            return sessionPlayer;
        }
    } catch(e) {}
    try {
        const local = localStorage.getItem('tc_player');
        if (local) {
            sessionPlayer = JSON.parse(local);
            return sessionPlayer;
        }
    } catch(e) {}
    return null;
}

async function saveAgentToFirebase(p) {
    const fs = window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    if (!fs || !p) return;
    try {
        const colName = window.AGENTS_COL || 'tc_agents';
        const docRef = await fs.collection(colName).add({
            name: p.name,
            roll: p.roll || p.playerId,
            dept: p.dept,
            year: p.year,
            phone: p.phone,
            roomCode: p.roomCode,
            playerSlot: p.playerSlot,
            isHost: !!p.isHost,
            score: 0,
            createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        });
        if (docRef && docRef.id) {
            console.log('[Firebase] Registered agent in tc_agents doc ID:', docRef.id);
            try { localStorage.setItem('tc_firebase_doc_id', docRef.id); } catch(e) {}
        }
    } catch(e) {
        console.warn('[Firebase] Agent registration note:', e);
    }
}

function startLevel1() {
    window.location.href = '/level1.html';
}
window.startLevel1 = startLevel1;

document.getElementById('btn-auth-proceed')?.addEventListener('click', () => {
    startLevel1();
});

function handleSinglePlayerLoginSubmit() {
    const nameInput = document.getElementById('playerName');
    const phoneInput = document.getElementById('phone');
    const deptInput = document.getElementById('department');
    const yearInput = document.getElementById('year');

    let n = nameInput ? nameInput.value.trim() : '';
    let phone = phoneInput ? phoneInput.value.trim() : '';
    let d = deptInput ? deptInput.value : '';
    let y = yearInput ? yearInput.value : '';

    if (!n || n.length < 2) n = 'Agent Alpha';
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) phone = '9876543210';
    if (!d) d = 'CSE (AI & ML)';
    if (!y) y = 'BE';

    if (typeof AUDIO !== 'undefined' && AUDIO.sfxSuccess) AUDIO.sfxSuccess();

    const agId = 'AG-' + Math.floor(1000 + Math.random() * 9000);
    const token = 'agent-' + Date.now();

    sessionPlayer = { name: n, roll: agId, dept: d, year: y, phone: phone, currentLvl: 1, playerId: 'player-1' };
    try {
        localStorage.setItem('tc_player', JSON.stringify(sessionPlayer));
        sessionStorage.setItem('tc_player_session', JSON.stringify(sessionPlayer));
        localStorage.setItem('tc_token', token);
        localStorage.setItem('tc_campaign_start_time', Date.now().toString());
    } catch(e) {}
    if (typeof API !== 'undefined') API.token = token;

    saveAgentToFirebase(sessionPlayer);

    startLevel1();
    return false;
}
window.handleSinglePlayerLoginSubmit = handleSinglePlayerLoginSubmit;

async function handleCreateTeamSubmit() {
    return handleSinglePlayerLoginSubmit();
}
window.handleCreateTeamSubmit = handleCreateTeamSubmit;

async function handleJoinTeamSubmit() {
    return handleSinglePlayerLoginSubmit();
}
window.handleJoinTeamSubmit = handleJoinTeamSubmit;




function updateLobbySlots(room) {
    if (!room) return;

    const curPlayer = getLocalPlayer();
    const firstPlayer = (room.players || [])[0];
    let isHost = false;

    if (curPlayer) {
        if (curPlayer.isHost === true || curPlayer.playerSlot === 1 || curPlayer.playerId === 'player-1') {
            isHost = true;
        } else if (firstPlayer && curPlayer.name && firstPlayer.name.toUpperCase() === curPlayer.name.toUpperCase()) {
            isHost = true;
        }
    } else {
        isHost = true;
    }

    const codeBadge = document.getElementById('room-code-badge');
    if (codeBadge) codeBadge.textContent = 'CODE: ' + room.roomCode;

    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) {
        roleBadge.textContent = isHost ? '👑 YOUR ROLE: HOST' : '👤 YOUR ROLE: TEAM MEMBER';
        roleBadge.style.color = isHost ? '#00f0ff' : '#fbbf24';
    }

    const playersCount = (room.players || []).length;
    const slotsBadge = document.getElementById('room-slots-badge');
    if (slotsBadge) slotsBadge.textContent = `PLAYERS: ${playersCount} / 4`;

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

    // Controls display logic: Host vs Non-Host
    const hostControls = document.getElementById('host-controls');
    const memberControls = document.getElementById('member-controls');
    const startBtn = document.getElementById('btn-start-tournament');
    const forceStartBtn = document.getElementById('btn-force-start');
    const memberStatusText = document.getElementById('member-status-text');

    if (isHost) {
        if (hostControls) hostControls.style.display = 'block';
        if (memberControls) memberControls.style.display = 'none';

        if (startBtn) {
            if (playersCount >= 4) {
                startBtn.disabled = false;
                startBtn.removeAttribute('disabled');
                startBtn.textContent = '🚀 BEGIN GAME (ALL 4 PLAYERS READY) ›';
                startBtn.style.opacity = '1';
                startBtn.style.cursor = 'pointer';
                startBtn.style.pointerEvents = 'auto';
                startBtn.style.background = 'linear-gradient(135deg, #00f0ff, #3b82f6)';
                startBtn.style.boxShadow = '0 0 20px rgba(0,240,255,0.6)';
                if (forceStartBtn) forceStartBtn.style.display = 'none';
            } else {
                startBtn.disabled = true;
                startBtn.setAttribute('disabled', 'disabled');
                startBtn.textContent = `WAITING FOR ALL 4 PLAYERS TO JOIN (${playersCount}/4)...`;
                startBtn.style.opacity = '0.5';
                startBtn.style.cursor = 'not-allowed';
                startBtn.style.pointerEvents = 'none';
                startBtn.style.background = 'rgba(255,255,255,0.1)';
                startBtn.style.boxShadow = 'none';
                if (forceStartBtn) forceStartBtn.style.display = 'block';
            }
        }
    } else {
        if (hostControls) hostControls.style.display = 'none';
        if (memberControls) memberControls.style.display = 'block';
        if (memberStatusText) {
            memberStatusText.textContent = `⏳ WAITING FOR HOST TO START THE GAME (${playersCount}/4 PLAYERS CONNECTED)...`;
        }
    }
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
