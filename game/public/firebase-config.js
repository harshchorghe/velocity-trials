/**
 * TECHCHASE 2K26 — FIREBASE CONFIG
 * Project ID: velocity-31f53
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDHviYUCMAZQZcYwVPnW7-tLsTabPA-gS8",
  authDomain: "velocity-31f53.firebaseapp.com",
  projectId: "velocity-31f53",
  storageBucket: "velocity-31f53.firebasestorage.app",
  messagingSenderId: "584499028026",
  appId: "1:584499028026:web:a1841de18838ffe1e45503",
  measurementId: "G-X4W8K41KNW"
};

/* ── Init Firebase App ── */
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log('[Firebase] Web SDK initialized for project:', FIREBASE_CONFIG.projectId);
  } catch (err) {
    console.error('[Firebase] Init error:', err);
  }
}

/* ── Global Firestore Export ── */
window.db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
window.AGENTS_COL = 'tc_agents';
const db = window.db;
const AGENTS_COL = window.AGENTS_COL;

/**
 * Ensures database contains level configuration (Level 1, 2, and 3 time limits & codes)
 * in Firestore under level_config documents and level1/levels subcollection.
 */
async function initDatabaseLevelConfig() {
  if (!window.db) return;
  try {
    // 1. Sync exact level_config/levels document matching user's Firestore schema
    const levelsRef = window.db.collection('level_config').doc('levels');
    await levelsRef.set({
      level1: 180,
      level2: 180,
      level3: 180
    }, { merge: true });

    // 2. Sync level1 target code document
    const l1Ref = window.db.collection('level_config').doc('level1');
    await l1Ref.set({
      secretCode: '2025',
      targetValue: 2025,
      levelName: 'Level 1: Physical Quest & Gesture Recognition'
    }, { merge: true });

    console.log('[Database] Synced level_config/levels (level1: 180, level2: 180, level3: 180) to Firestore.');
  } catch (err) {
    console.warn('[Database] Level config sync note:', err.message || err);
  }
}

async function fetchLevel1TargetCode() {
  if (window.db) {
    try {
      const snap = await window.db.collection('level_config').doc('level1').get();
      if (snap.exists && snap.data() && snap.data().secretCode) {
        return String(snap.data().secretCode);
      }
    } catch (e) {
      console.warn('[Database] Falling back to default target code 2025:', e.message || e);
    }
  }
  return '2025';
}

async function fetchLevelTime(levelNum) {
  const defaultSeconds = 180; // 3 minutes default
  if (!window.db) return defaultSeconds;
  try {
    const lvlKey = 'level' + levelNum;
    
    // Primary lookup: level_config/levels document (exact user schema: level1: 180, level2: 180, level3: 180)
    const levelsSnap = await window.db.collection('level_config').doc('levels').get();
    if (levelsSnap.exists && levelsSnap.data()) {
      const data = levelsSnap.data();
      if (data[lvlKey] !== undefined && !isNaN(data[lvlKey])) {
        return Number(data[lvlKey]);
      }
    }

    // Secondary fallback: level_config/levelX document
    const snap = await window.db.collection('level_config').doc(lvlKey).get();
    if (snap.exists && snap.data()) {
      const data = snap.data();
      if (data.timeLimitSeconds && !isNaN(data.timeLimitSeconds)) {
        return Number(data.timeLimitSeconds);
      }
      if (data.timeLimitMinutes && !isNaN(data.timeLimitMinutes)) {
        return Number(data.timeLimitMinutes) * 60;
      }
    }
  } catch (e) {
    console.warn(`[Database] Error fetching time limit for Level ${levelNum}:`, e.message || e);
  }
  return defaultSeconds;
}

window.fetchLevel1TargetCode = fetchLevel1TargetCode;
window.fetchLevelTime = fetchLevelTime;
initDatabaseLevelConfig();

