"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MultiplayerManager } from "../components/MultiplayerManager";
import { EnemyManager } from "../components/EnemyManager";
import { GestureController } from "../components/GestureController";
import { StoneManager } from "../components/StoneManager";
import { CompletionVideoOverlay } from "../components/CompletionVideoOverlay";
import { ThirdPersonCamera } from "../components/ThirdPersonCamera";
import { StoneNavigationWidget } from "../components/StoneNavigationWidget";
import { EnergyBarrier } from "../components/EnergyBarrier";
import { Level3Scene } from "../components/level3/Level3Scene";
import { Level3HUD } from "../components/level3/Level3HUD";
import { gameState, formatTime } from "../utils/gameState";
import { fetchSessionInfo } from "../utils/api";
import { RoomLeaderboardModal } from "../components/RoomLeaderboardModal";
import { updateAgentProgressInFirebase } from "../utils/firebase";

const CITY = "/models/ciudadortogonal26.glb";
const PLAYER = "/models/player1.glb";
const ENEMY = "/models/enemy-robo.glb";

function City({ onLoaded }: { onLoaded: (scene: THREE.Object3D) => void }) {
  const { scene } = useGLTF(CITY);

  useEffect(() => {
    if (scene) {
      scene.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.frustumCulled = false; // Prevents Three.js frustum culling from hiding city blocks
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              mat.side = THREE.DoubleSide;
            });
          } else if (mesh.material) {
            mesh.material.side = THREE.DoubleSide;
          }
        }
      });
      onLoaded(scene);
    }
  }, [scene, onLoaded]);

  return <primitive object={scene} position={[0, -1, 0]} />;
}

useGLTF.preload(CITY);
useGLTF.preload(PLAYER);
useGLTF.preload(ENEMY);

export default function Home() {
  const [activeLevel, setActiveLevel] = useState<2 | 3>(2);
  const [activeControlledId, setActiveControlledId] = useState<string>("player-1");
  const [activeTab, setActiveTab] = useState<"players" | "enemies">("enemies");
  const [detectionRange, setDetectionRange] = useState<number>(25);
  const [, setForceTick] = useState<number>(0);

  // Level 3 State
  const [l3BattleState, setL3BattleState] = useState<"FIGHTING" | "VICTORY" | "DEFEAT">("FIGHTING");
  const [l3ElapsedTimeSec, setL3ElapsedTimeSec] = useState<number>(0);
  const [l3ResetSignal, setL3ResetSignal] = useState<number>(0);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  // Sync player info from URL parameters & Local Room Session API
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token") || localStorage.getItem("tc_token") || "";
      const urlLevel = params.get("level");

      try {
        const pStr = localStorage.getItem("tc_player");
        if (pStr) {
          const p = JSON.parse(pStr);
          if (p.playerId && gameState.players[p.playerId]) {
            setActiveControlledId(p.playerId);
            if (p.name) gameState.players[p.playerId].name = p.name;
          }
        }
      } catch (e) {}

      if (urlToken) {
        localStorage.setItem("tc_token", urlToken);
        fetchSessionInfo(urlToken).then((info) => {
          if (info && info.playerName && gameState.players["player-1"]) {
            gameState.players["player-1"].name = info.playerName;
          }
        });
      }

      if (urlLevel === "3") {
        setActiveLevel(3);
      }
    }
  }, []);

  const handleCityLoaded = (scene: THREE.Object3D) => {
    gameState.setCityScene(scene);
  };

  const [finalTotalTimeSec, setFinalTotalTimeSec] = useState<number | null>(null);

  const handleL3BattleStateChange = useCallback((state: "FIGHTING" | "VICTORY" | "DEFEAT", elapsedSec: number) => {
    setL3BattleState(state);
    setL3ElapsedTimeSec(elapsedSec);

    if (typeof window !== "undefined") {
      const docId = localStorage.getItem("tc_firebase_doc_id");
      const start = parseInt(localStorage.getItem("tc_campaign_start_time") || "0", 10);
      const totalSec = start > 0 ? Math.floor((Date.now() - start) / 1000) : elapsedSec;

      if (state === "VICTORY") {
        // Freeze total time counter immediately upon completing Level 3
        setFinalTotalTimeSec(totalSec);
        setCampaignElapsedSec(totalSec);

        localStorage.setItem("tc_final_total_time", totalSec.toString());
        localStorage.setItem("tc_final_completion_time", formatTime(totalSec));

        // Save to Firebase Database
        if (docId) {
          updateAgentProgressInFirebase(docId, {
            maxLevel: 3,
            status: "COMPLETED",
            totalTimeSeconds: totalSec,
          });
        }

        // Save to Local Room Session Database
        try {
          const rCode = localStorage.getItem("vt_current_room_code");
          const rStr = localStorage.getItem("vt_current_room") || (rCode ? localStorage.getItem("vt_room_" + rCode) : null);
          if (rStr) {
            const rData = JSON.parse(rStr);
            if (rData && rData.players) {
              const pSlot = JSON.parse(localStorage.getItem("tc_player") || "{}").playerSlot || 1;
              const p = rData.players.find((x: any) => x.slot === pSlot || x.id === "player-1");
              if (p) {
                p.totalTimeSeconds = totalSec;
                p.level3BossTime = elapsedSec;
                p.status = "COMPLETED";
                p.completionTimeFormatted = formatTime(totalSec);
              }
              rData.winnerName = rData.winnerName || p?.name || "Agent";
              localStorage.setItem("vt_current_room", JSON.stringify(rData));
              if (rCode) localStorage.setItem("vt_room_" + rCode, JSON.stringify(rData));
            }
          }
        } catch (e) {}
      } else if (state === "DEFEAT") {
        if (docId) {
          updateAgentProgressInFirebase(docId, {
            maxLevel: 3,
            status: "ELIMINATED",
            totalTimeSeconds: totalSec,
          });
        }
      }
    }
  }, []);

  const handleResetLevel3 = () => {
    setL3BattleState("FIGHTING");
    setL3ElapsedTimeSec(0);
    setFinalTotalTimeSec(null);
    setL3ResetSignal((s) => s + 1);
  };

  useEffect(() => {
    gameState.detectionRange = detectionRange;
  }, [detectionRange]);

  // 10 Hz lightweight HUD refresh interval (ONLY active during Level 2 to prevent Level 3 re-render overhead)
  useEffect(() => {
    if (activeLevel !== 2) return;
    const interval = setInterval(() => {
      setForceTick((t) => (t + 1) % 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [activeLevel]);

  const [campaignElapsedSec, setCampaignElapsedSec] = useState<number>(0);

  useEffect(() => {
    // Stop running total time timer when victory is reached
    if (l3BattleState === "VICTORY" || finalTotalTimeSec !== null) return;

    const updateCampaignTime = () => {
      if (typeof window !== "undefined") {
        const start = parseInt(localStorage.getItem("tc_campaign_start_time") || "0", 10);
        if (start > 0) {
          setCampaignElapsedSec(Math.floor((Date.now() - start) / 1000));
        }
      }
    };
    updateCampaignTime();
    const interval = setInterval(updateCampaignTime, 500);
    return () => clearInterval(interval);
  }, [l3BattleState, finalTotalTimeSec]);

  const activePlayer = gameState.players[activeControlledId] || gameState.players["player-1"];

  // Automatically transition to Level 3 upon completing Level 2
  useEffect(() => {
    if (activeLevel === 2 && activePlayer && activePlayer.status === "QUALIFIED") {
      setActiveLevel(3);
      setL3BattleState("FIGHTING");
      setL3ElapsedTimeSec(0);
      setL3ResetSignal((s) => s + 1);

      if (typeof window !== "undefined") {
        const docId = localStorage.getItem("tc_firebase_doc_id");
        const start = parseInt(localStorage.getItem("tc_campaign_start_time") || "0", 10);
        const totalSec = start > 0 ? Math.floor((Date.now() - start) / 1000) : 0;
        if (docId) {
          updateAgentProgressInFirebase(docId, {
            maxLevel: 3,
            status: "QUALIFIED",
            totalTimeSeconds: totalSec,
          });
        }
      }
    }
  }, [activeLevel, activePlayer, activePlayer?.status]);
  const activeStones = activePlayer ? activePlayer.stonesCollected || 0 : 0;
  const timerDisplay = activePlayer
    ? activePlayer.completionTimeFormatted || formatTime(activePlayer.elapsedTimeSec)
    : "00:00";

  // Level 3: determine which player enters the boss fight
  const l3QualifiedId = gameState.qualifiedPlayerIds[0] || activeControlledId;

  const isCompletionScreenActive =
    activeLevel === 2 && activePlayer && (activePlayer.status === "QUALIFIED" || activePlayer.status === "ELIMINATED");

  return (
    <main
      suppressHydrationWarning
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        background: "#020617",
      }}
    >
      {/* Real-Time Player-Specific 360° Stone Objective Navigator */}
      {activeLevel === 2 && <StoneNavigationWidget activeControlledId={activeControlledId} />}

      {/* HUD UI Overlay — Hidden when Level 2 completion screen is active */}
      {!isCompletionScreenActive && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "310px",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {/* Header Title Card */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.88)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "14px 18px",
              color: "#ffffff",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Level Switcher Buttons */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
              <button
                onClick={() => setActiveLevel(2)}
                style={{
                  flex: 1,
                  background: activeLevel === 2 ? "#38bdf8" : "rgba(30, 41, 59, 0.8)",
                  color: activeLevel === 2 ? "#0f172a" : "#94a3b8",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "10px",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                🏙️ LEVEL 2 (CITY)
              </button>
              <button
                onClick={() => {
                  setActiveLevel(3);
                  handleResetLevel3();
                }}
                style={{
                  flex: 1,
                  background: activeLevel === 3 ? "#ef4444" : "rgba(30, 41, 59, 0.8)",
                  color: activeLevel === 3 ? "#ffffff" : "#94a3b8",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "10px",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                👑 LEVEL 3 (ASTRA)
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h1 style={{ margin: 0, fontSize: "14px", fontWeight: 700, letterSpacing: "0.5px" }}>
                {activeLevel === 2 ? "Level 2: City & Stones" : "Level 3: Astra Boss Arena"}
              </h1>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span
                  style={{
                    background: "rgba(0, 240, 255, 0.2)",
                    color: "#00f0ff",
                    border: "1px solid rgba(0, 240, 255, 0.4)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "10px",
                    fontWeight: 800,
                  }}
                >
                  ⏱️ TOTAL: {formatTime(campaignElapsedSec)}
                </span>
                <span
                  style={{
                    background: "rgba(56, 189, 248, 0.2)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "10px",
                    fontWeight: 700,
                  }}
                >
                  ⏱️ {activeLevel === 3 ? formatTime(l3ElapsedTimeSec) : timerDisplay}
                </span>
                {activeLevel === 2 && (
                  <span
                    style={{
                      background: "rgba(56, 189, 248, 0.2)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      padding: "2px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    💎 {activeStones}/3
                  </span>
                )}
              </div>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#94a3b8", lineHeight: 1.4 }}>
              {activeLevel === 2
                ? <>Control active player with <strong>AI Hand Gestures</strong> (camera active). Collect all 3 stones to trigger Level 3.</>
                : <>Final Boss Battle! Defeat <strong>ASTRA</strong> to clear Level 3.</>
              }
            </p>

            {/* Configurable Detection Range Slider */}
            {activeLevel === 2 && (
              <div
                style={{
                  marginTop: "12px",
                  paddingTop: "10px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#cbd5e1" }}>
                  <span>AI Detection Range:</span>
                  <strong style={{ color: "#38bdf8" }}>{detectionRange} meters</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={detectionRange}
                  onChange={(e) => setDetectionRange(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "#38bdf8",
                    cursor: "pointer",
                  }}
                />
              </div>
            )}
          </div>

          {/* AI Gesture Controller Widget */}
          {activeLevel === 2 && <GestureController />}

          {/* Level 3 HUD is rendered dynamically inside Level3Scene with full state */}
        </div>
      )}

      {/* 3D R3F Canvas */}
      <Canvas
        dpr={[1, 1.25]}
        camera={{
          position: [0, 40, 50],
          fov: 50,
          near: 0.1,
          far: 5000,
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        {/* Atmospheric Depth Fog & Cyberpunk Ambiance Lighting */}
        <fog attach="fog" args={["#020617", 40, 180]} />
        <ambientLight intensity={0.9} color="#38bdf8" />
        <directionalLight position={[25, 45, 25]} intensity={1.8} color="#fbbf24" castShadow />
        <hemisphereLight args={["#38bdf8", "#020617", 0.6]} />
        <Environment preset="city" />

        {activeLevel === 2 ? (
          <>
            {/* Level 2 City Environment */}
            <City onLoaded={handleCityLoaded} />
            <MultiplayerManager activeControlledId={activeControlledId} />
            <StoneManager />
            <EnergyBarrier />
            <ThirdPersonCamera activeControlledId={activeControlledId} />
          </>
        ) : (
          <Level3Scene
            qualifiedPlayerId={l3QualifiedId}
            onBattleStateChange={handleL3BattleStateChange}
            resetSignal={l3ResetSignal}
          />
        )}
      </Canvas>

      {/* LEVEL 3 2D VIEWPORT RESULT OVERLAYS (EXACT VIEWPORT CENTERING) */}
      {activeLevel === 3 && l3BattleState === "VICTORY" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
            background: "rgba(2, 6, 23, 0.94)",
            backdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              background: "rgba(15, 23, 42, 0.96)",
              border: "2px solid #22c55e",
              borderRadius: "20px",
              padding: "40px 48px",
              textAlign: "center",
              maxWidth: "700px",
              width: "min(90vw, 700px)",
              boxShadow: "0 0 60px rgba(34, 197, 94, 0.6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              color: "#ffffff",
            }}
          >
            <div style={{ fontSize: "64px", lineHeight: 1 }}>🎉</div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 900,
                color: "#22c55e",
                letterSpacing: "2px",
                margin: 0,
              }}
            >
              CONGRATULATIONS!
            </h1>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "1px",
                margin: 0,
              }}
            >
              👑 ASTRA DEFEATED
            </h2>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#4ade80",
                letterSpacing: "1px",
                margin: 0,
              }}
            >
              YOU HAVE SAVED HUMANITY!
            </h3>

            <p style={{ color: "#cbd5e1", fontSize: "14px", margin: "4px 0", lineHeight: "1.6" }}>
              ASTRA's corruption has been destroyed.<br />
              The Void Virus has been stopped.<br />
              Humanity has been given a second chance.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                margin: "4px 0",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                  borderRadius: "12px",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#38bdf8",
                }}
              >
                ⏱️ BOSS TIME: <span style={{ color: "#ffffff", fontSize: "15px", marginLeft: "6px" }}>{formatTime(l3ElapsedTimeSec)}</span>
              </div>
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid rgba(0, 240, 255, 0.4)",
                  borderRadius: "12px",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#00f0ff",
                }}
              >
                ⏱️ TOTAL CAMPAIGN TIME: <span style={{ color: "#ffffff", fontSize: "15px", marginLeft: "6px" }}>{formatTime(campaignElapsedSec)}</span>
              </div>
            </div>

            <div style={{ fontSize: "14px", fontWeight: 900, color: "#22c55e", letterSpacing: "1.5px", marginTop: "4px" }}>
              🌟 HUMANITY IS SAVED
            </div>

            <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
              <button
                onClick={() => setShowLeaderboard(true)}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "14px 24px",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 0 25px rgba(56, 189, 248, 0.6)",
                  letterSpacing: "0.5px",
                }}
              >
                🏆 TOURNAMENT LEADERBOARD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOURNAMENT LEADERBOARD OVERLAY */}
      {showLeaderboard && (
        <RoomLeaderboardModal
          l3ElapsedTimeSec={l3ElapsedTimeSec}
          winnerName={activePlayer?.name}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {activeLevel === 3 && l3BattleState === "DEFEAT" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
            background: "rgba(2, 6, 23, 0.94)",
            backdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              background: "rgba(15, 23, 42, 0.96)",
              border: "2px solid #ef4444",
              borderRadius: "20px",
              padding: "40px 48px",
              textAlign: "center",
              maxWidth: "700px",
              width: "min(90vw, 700px)",
              boxShadow: "0 0 60px rgba(239, 68, 68, 0.6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              color: "#ffffff",
            }}
          >
            <div style={{ fontSize: "64px", lineHeight: 1 }}>💀</div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 900,
                color: "#ef4444",
                letterSpacing: "2px",
                margin: 0,
              }}
            >
              ELIMINATED
            </h1>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 900,
                color: "#fca5a5",
                letterSpacing: "1px",
                margin: 0,
              }}
            >
              👑 VOID VIRUS HAS TAKEN OVER YOU TOO !!!
            </h2>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#f87171",
                margin: 0,
              }}
            >
              Humanity's last hope has fallen.
            </h3>

            <p style={{ color: "#cbd5e1", fontSize: "14px", margin: "4px 0", lineHeight: "1.6" }}>
              The Void Virus has consumed the final defender.<br />
              All defenses have collapsed.
            </p>

            <div style={{ display: "flex", gap: "16px", margin: "4px 0" }}>
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#cbd5e1",
                }}
              >
                ⏱️ TIME SURVIVED: <span style={{ color: "#ffffff", fontSize: "16px", marginLeft: "6px" }}>{formatTime(l3ElapsedTimeSec)}</span>
              </div>
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#ef4444",
                }}
              >
                ❤️ LIVES: 0
              </div>
            </div>

            <div style={{ fontSize: "14px", fontWeight: 900, color: "#ef4444", letterSpacing: "1.5px", marginTop: "4px" }}>
              🥀 HUMANITY HAS FALLEN
            </div>

            <button
              onClick={handleResetLevel3}
              style={{
                background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                border: "none",
                borderRadius: "10px",
                padding: "14px 36px",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 0 25px rgba(239, 68, 68, 0.6)",
                letterSpacing: "0.5px",
                marginTop: "8px",
              }}
            >
              🔄 RETRY LEVEL 3 (1 LIFE)
            </button>
          </div>
        </div>
      )}

      {/* FULLSCREEN SUCCESS VIDEO OVERLAY ("LEVEL 2 CLEARED!") */}
      {activeLevel === 2 && activePlayer && activePlayer.status === "QUALIFIED" && (
        <CompletionVideoOverlay
          player={activePlayer}
          videoUrl={gameState.completionVideoUrl}
          onReset={() => gameState.resetPlayer()}
          onProceedToLevel3={() => setActiveLevel(3)}
        />
      )}

      {/* FULLSCREEN DEFEAT OVERLAY ("YOU WERE DEFEATED / MISSION FAILED") */}
      {activeLevel === 2 && activePlayer && activePlayer.status === "ELIMINATED" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 100,
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div
            style={{
              background: "rgba(30, 41, 59, 0.95)",
              border: "2px solid #ef4444",
              borderRadius: "16px",
              padding: "36px 48px",
              textAlign: "center",
              boxShadow: "0 0 50px rgba(239, 68, 68, 0.4)",
              maxWidth: "480px",
              color: "#ffffff",
            }}
          >
            <div style={{ fontSize: "56px", marginBottom: "8px" }}>💀</div>
            <h1
              style={{
                margin: "0 0 4px 0",
                fontSize: "30px",
                fontWeight: 900,
                color: "#ef4444",
                letterSpacing: "1px",
                textShadow: "0 0 20px rgba(239, 68, 68, 0.6)",
              }}
            >
              YOU WERE DEFEATED
            </h1>
            <h2
              style={{
                margin: "0 0 12px 0",
                fontSize: "18px",
                fontWeight: 800,
                color: "#f87171",
                letterSpacing: "0.5px",
              }}
            >
              MISSION FAILED
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: "0 0 24px 0", lineHeight: 1.5 }}>
              You failed the mission to defeat ASTRA.
            </p>

            {/* Defeat Summary */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "16px 24px",
                marginBottom: "28px",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "#cbd5e1" }}>Stones Collected:</span>
                <strong style={{ color: "#38bdf8" }}>{activeStones}/3 💎</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "#cbd5e1" }}>Lives Remaining:</span>
                <strong style={{ color: "#ef4444" }}>0 ❤️</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "#cbd5e1" }}>Time Elapsed:</span>
                <strong style={{ color: "#94a3b8" }}>
                  {formatTime(activePlayer.elapsedTimeSec)} ⏱️
                </strong>
              </div>
            </div>

            <button
              onClick={() => gameState.resetPlayer(activeControlledId)}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "14px 24px",
                fontSize: "16px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
              }}
            >
              RETRY LEVEL 2
            </button>
          </div>
        </div>
      )}
    </main>
  );
}