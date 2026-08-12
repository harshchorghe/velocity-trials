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
 * Ensures database contains Level 1 target gesture code (2025)
 * and exports fetch function.
 */
async function initDatabaseLevel1Config() {
  if (!window.db) return;
  try {
    const configRef = window.db.collection('level_config').doc('level1');
    const snap = await configRef.get();
    if (!snap.exists || !snap.data().secretCode) {
      await configRef.set({
        secretCode: '2025',
        targetValue: 2025,
        levelName: 'Level 1: Physical Quest & Gesture Recognition',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('[Database] Stored Level 1 secret code 2025 in Firestore.');
    }
  } catch (err) {
    console.warn('[Database] Level 1 config sync note:', err.message || err);
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

window.fetchLevel1TargetCode = fetchLevel1TargetCode;
initDatabaseLevel1Config();

