import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
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
  score?: number;
  crystals?: number;
  timeFormatted?: string;
  createdAt?: any;
}

export async function saveAgentToFirebase(agentData: Partial<AgentData>): Promise<string | null> {
  try {
    const payload = {
      name: agentData.name || "Agent",
      roll: agentData.roll || "2K26",
      dept: agentData.dept || "CSE",
      year: agentData.year || "1st Year",
      phone: agentData.phone || "",
      score: agentData.score || 0,
      crystals: agentData.crystals || 0,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, AGENTS_COL), payload);

    try {
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

export async function updateAgentScoreInFirebase(docId: string, score: number, crystals = 0): Promise<boolean> {
  if (!docId) return false;
  try {
    const agentRef = doc(db, AGENTS_COL, docId);
    await updateDoc(agentRef, { score, crystals });
    return true;
  } catch (err) {
    console.error("[Firebase] updateScore error:", err);
    return false;
  }
}

export async function getAgentsFromFirebase(): Promise<AgentData[]> {
  try {
    const q = query(collection(db, AGENTS_COL), orderBy("score", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AgentData) }));
  } catch (err) {
    console.error("[Firebase] getAgents error:", err);
    try {
      return JSON.parse(localStorage.getItem("tc_agents") || "[]");
    } catch (_) {
      return [];
    }
  }
}

export function onAgentsUpdate(callback: (agents: AgentData[]) => void) {
  try {
    const q = query(collection(db, AGENTS_COL), orderBy("score", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const agents = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AgentData) }));
        callback(agents);
      },
      (err) => {
        console.error("[Firebase] onSnapshot error:", err);
        try {
          callback(JSON.parse(localStorage.getItem("tc_agents") || "[]"));
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
