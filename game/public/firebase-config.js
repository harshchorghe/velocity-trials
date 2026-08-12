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
