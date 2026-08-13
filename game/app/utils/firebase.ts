import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDHviYUCMAZQZcYwVPnW7-tLsTabPA-gS8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "velocity-31f53.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "velocity-31f53",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "velocity-31f53.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "584499028026",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:584499028026:web:a1841de18838ffe1e45503",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-X4W8K41KNW",
};


const app = !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp();
export const db = getFirestore(app);
export const AGENTS_COL = "tc_agents";

export interface AgentData {
  id?: string;
  name: string;
  roll?: string;
  dept?: string;
  year?: string;
  phone?: string;
  maxLevel?: number; // 1, 2, or 3
  status?: string; // 'COMPLETED' | 'QUALIFIED' | 'TIME_EXPIRED' | 'IN_PROGRESS'
  totalTimeSeconds?: number;
  score?: number;
  crystals?: number;
  timeFormatted?: string;
  createdAt?: any;
  updatedAt?: any;
}

export function sortAgentsForLeaderboard(agents: AgentData[]): AgentData[] {
  return [...agents].sort((a, b) => {
    // 1. COMPLETED status comes first
    const aCompleted = a.status === "COMPLETED" ? 1 : 0;
    const bCompleted = b.status === "COMPLETED" ? 1 : 0;
    if (aCompleted !== bCompleted) return bCompleted - aCompleted;

    // 2. Higher Level Reached comes next
    const aLvl = a.maxLevel || 1;
    const bLvl = b.maxLevel || 1;
    if (aLvl !== bLvl) return bLvl - aLvl;

    // 3. Lowest Total Campaign Time (ascending) — most critical!
    const aTime = typeof a.totalTimeSeconds === "number" && a.totalTimeSeconds >= 0 ? a.totalTimeSeconds : 999999;
    const bTime = typeof b.totalTimeSeconds === "number" && b.totalTimeSeconds >= 0 ? b.totalTimeSeconds : 999999;
    return aTime - bTime;
  });
}

export async function saveAgentToFirebase(agentData: Partial<AgentData>): Promise<string | null> {
  try {
    const payload = {
      name: agentData.name || "Agent",
      roll: agentData.roll || "2K26",
      dept: agentData.dept || "CSE",
      year: agentData.year || "BE",
      phone: agentData.phone || "",
      maxLevel: agentData.maxLevel || 1,
      status: agentData.status || "IN_PROGRESS",
      totalTimeSeconds: agentData.totalTimeSeconds || 0,
      score: agentData.score || 0,
      crystals: agentData.crystals || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, AGENTS_COL), payload);

    try {
      localStorage.setItem("tc_firebase_doc_id", docRef.id);
      const cached = JSON.parse(localStorage.getItem("tc_agents") || "[]");
      cached.push({ ...payload, id: docRef.id });
      localStorage.setItem("tc_agents", JSON.stringify(cached));
    } catch (_) { }

    return docRef.id;
  } catch (err) {
    console.error("[Firebase] saveAgent error:", err);
    return null;
  }
}

export async function updateAgentProgressInFirebase(
  docId: string,
  progress: {
    maxLevel?: number;
    status?: string;
    totalTimeSeconds?: number;
    score?: number;
    crystals?: number;
  }
): Promise<boolean> {
  if (!docId) return false;
  try {
    const agentRef = doc(db, AGENTS_COL, docId);
    await updateDoc(agentRef, {
      ...progress,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("[Firebase] updateAgentProgress error:", err);
    return false;
  }
}

export async function updateAgentScoreInFirebase(docId: string, score: number, crystals = 0): Promise<boolean> {
  return updateAgentProgressInFirebase(docId, { score, crystals });
}

export async function getAgentsFromFirebase(): Promise<AgentData[]> {
  try {
    const snap = await getDocs(collection(db, AGENTS_COL));
    const agents = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AgentData) }));
    return sortAgentsForLeaderboard(agents);
  } catch (err) {
    console.error("[Firebase] getAgents error:", err);
    try {
      const cached = JSON.parse(localStorage.getItem("tc_agents") || "[]");
      return sortAgentsForLeaderboard(cached);
    } catch (_) {
      return [];
    }
  }
}

export function onAgentsUpdate(callback: (agents: AgentData[]) => void) {
  try {
    return onSnapshot(
      collection(db, AGENTS_COL),
      (snap) => {
        const agents = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AgentData) }));
        callback(sortAgentsForLeaderboard(agents));
      },
      (err) => {
        console.error("[Firebase] onSnapshot error:", err);
        try {
          const cached = JSON.parse(localStorage.getItem("tc_agents") || "[]");
          callback(sortAgentsForLeaderboard(cached));
        } catch (_) {
          callback([]);
        }
      }
    );
  } catch (err) {
    console.error("[Firebase] Listener setup error:", err);
    return () => { };
  }
}

export async function fetchLevelTimeFromFirebase(levelNum: number): Promise<number> {
  const defaultSeconds = 180;
  const cacheKey = `vt_level_${levelNum}_time`;

  // 1. Try window.fetchLevelTime (compat SDK) if available
  if (typeof window !== "undefined" && typeof (window as any).fetchLevelTime === "function") {
    try {
      const val = await (window as any).fetchLevelTime(levelNum);
      if (val && val > 0) {
        localStorage.setItem(cacheKey, val.toString());
        return val;
      }
    } catch (_) {}
  }

  // 2. Try Modular Firebase SDK getDoc
  try {
    const levelsDocRef = doc(db, "level_config", "levels");
    const snap = await getDoc(levelsDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const lvlKey = `level${levelNum}`;
      if (data && data[lvlKey] !== undefined) {
        const val = Number(data[lvlKey]);
        if (!isNaN(val) && val > 0) {
          localStorage.setItem(cacheKey, val.toString());
          console.log(`[Firebase] Loaded Level ${levelNum} time limit from level_config/levels: ${val}s`);
          return val;
        }
      }
    }
  } catch (err: any) {
    if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
      console.info(`[Firebase Note] Firestore rules restricted direct read for level_config/levels. To enable, update Firestore Rules to allow read on level_config.`);
    }
  }

  // 3. Fallback to localStorage cached value if previously loaded
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(cacheKey);
    if (cached && !isNaN(Number(cached)) && Number(cached) > 0) {
      return Number(cached);
    }
  }

  return defaultSeconds;
}

