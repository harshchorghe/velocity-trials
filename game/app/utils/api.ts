/**
 * Direct Client-Side Firebase integration for 3D Game
 * Zero Backend Server required!
 */
import { saveAgentToFirebase, updateAgentScoreInFirebase } from "./firebase";

export interface PlayerSessionInfo {
  token: string;
  playerName: string;
  department?: string;
  rollNumber?: string;
  currentLevel?: number;
}

export async function fetchSessionInfo(_token: string): Promise<PlayerSessionInfo | null> {
  if (typeof window === "undefined") return null;

  try {
    const saved = localStorage.getItem("tc_player");
    if (saved) {
      const p = JSON.parse(saved);
      return {
        token: _token || "client-session",
        playerName: p.name || "Agent",
        department: p.dept || "CSE",
        rollNumber: p.roll || "2K26",
        currentLevel: 2,
      };
    }
  } catch (err) {
    console.warn("[Firebase Client] Failed to read cached session:", err);
  }

  return {
    token: _token || "client-session",
    playerName: "Agent",
    department: "CSE",
    rollNumber: "2K26",
    currentLevel: 2,
  };
}

export async function reportCrystalCollected(_token: string, crystalIndex: number): Promise<boolean> {
  try {
    const docId = typeof window !== "undefined" ? localStorage.getItem("tc_firebase_doc_id") || "" : "";
    const score = (crystalIndex + 1) * 500;
    if (docId) {
      await updateAgentScoreInFirebase(docId, score, crystalIndex + 1);
    }
    return true;
  } catch (err) {
    console.warn("[Firebase Client] Failed to sync crystal collection:", err);
    return false;
  }
}

export async function reportBossAction(_token: string, action: string, seq: number): Promise<boolean> {
  try {
    const docId = typeof window !== "undefined" ? localStorage.getItem("tc_firebase_doc_id") || "" : "";
    const bonus = action === "ultimate" ? 1000 : 300;
    const currentScore = (seq + 1) * bonus;
    if (docId) {
      await updateAgentScoreInFirebase(docId, currentScore);
    }
    return true;
  } catch (err) {
    console.warn("[Firebase Client] Failed to sync boss action:", err);
    return false;
  }
}

export const gameApi = {
  fetchSessionInfo,
  reportCrystalCollected,
  reportBossAction,
  saveAgentToFirebase,
};
