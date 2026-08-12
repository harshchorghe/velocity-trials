"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { gameState } from "../utils/gameState";

const PLAYER_MODEL_URL = "/models/player1.glb";

interface PlayerProps {
  id: string;
}

export function Player({ id }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Load shared GLB asset
  const { scene: baseScene, animations } = useGLTF(PLAYER_MODEL_URL);

  // Clone GLTF scene graph for independent skeleton and animation mixer
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(baseScene);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [baseScene]);

  const { actions, names } = useAnimations(animations, groupRef);
  const currentAnimRef = useRef<string>("idle");

  // Real-time 60 FPS transform & animation update loop
  useFrame(() => {
    if (!groupRef.current) return;

    const playerData = gameState.players[id];
    if (!playerData) return;

    // 1. Direct transform positioning (Zero lag / zero stutter)
    groupRef.current.position.set(playerData.pos[0], playerData.pos[1], playerData.pos[2]);
    groupRef.current.rotation.y = playerData.rotationY;

    // 2. Animation state trigger
    const reqAnim = playerData.activeAnim || "idle";
    if (reqAnim !== currentAnimRef.current) {
      currentAnimRef.current = reqAnim;

      const matchedName = names.find((n) => n.trim() === reqAnim.trim()) || names[0];
      if (matchedName && actions[matchedName]) {
        // Fade out previous actions and play requested animation
        Object.values(actions).forEach((act) => act?.fadeOut(0.15));
        actions[matchedName]?.reset().fadeIn(0.15).play();
      }
    }
  });

  const playerData = gameState.players[id] || {
    name: id,
    color: "#38bdf8",
    isLocalPlayer: false,
    health: 100,
    maxHealth: 100,
    lives: 3,
  };

  const healthPercent = Math.max(0, Math.min(100, (playerData.health / playerData.maxHealth) * 100));

  const activeLocalPlayer =
    Object.values(gameState.players).find((p) => p.isLocalPlayer) || gameState.players["player-1"];
  const isCompletionActive =
    activeLocalPlayer && (activeLocalPlayer.status === "QUALIFIED" || activeLocalPlayer.status === "ELIMINATED");

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={[0.65, 0.65, 0.65]} />

      {/* Overhead 3D HUD Badge (Drei Html 50% scale fix) — Hidden when Level 2 completion screen is active */}
      {!isCompletionActive && (
        <Html
          position={[0, 1.8, 0]}
          center
          distanceFactor={8}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
            transform: "scale(0.6)",
            transformOrigin: "bottom center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(6px)",
              border: `1px solid ${playerData.color}`,
              borderRadius: "5px",
              padding: "2px 5px",
              boxShadow: `0 0 6px ${playerData.color}33`,
              color: "#ffffff",
              fontFamily: "system-ui, sans-serif",
              fontSize: "9px",
              fontWeight: 600,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: playerData.color,
                  boxShadow: `0 0 4px ${playerData.color}`,
                }}
              />
              <span style={{ color: "#f8fafc", fontWeight: 700 }}>{playerData.name}</span>
              {playerData.isLocalPlayer && (
                <span
                  style={{
                    background: playerData.color,
                    color: "#0f172a",
                    padding: "1px 3px",
                    borderRadius: "3px",
                    fontSize: "7px",
                    fontWeight: 800,
                  }}
                >
                  YOU
                </span>
              )}
              {playerData.status === "QUALIFIED" ? (
                <span
                  style={{
                    background: "rgba(34, 197, 94, 0.3)",
                    color: "#4ade80",
                    border: "1px solid rgba(34, 197, 94, 0.5)",
                    padding: "1px 3px",
                    borderRadius: "3px",
                    fontSize: "7px",
                    fontWeight: 800,
                  }}
                >
                  🏆 QUALIFIED ({playerData.completionTimeFormatted})
                </span>
              ) : playerData.status === "ELIMINATED" ? (
                <span
                  style={{
                    background: "rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.5)",
                    padding: "1px 3px",
                    borderRadius: "3px",
                    fontSize: "7px",
                    fontWeight: 800,
                  }}
                >
                  💀 ELIMINATED
                </span>
              ) : (
                <>
                  <span
                    style={{
                      background: "rgba(56, 189, 248, 0.2)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      padding: "1px 3px",
                      borderRadius: "3px",
                      fontSize: "8px",
                      fontWeight: 700,
                    }}
                  >
                    💎 {playerData.stonesCollected || 0}/3
                  </span>
                </>
              )}
            </div>

            <div
              style={{
                width: "40px",
                height: "3px",
                backgroundColor: "rgba(51, 65, 85, 0.8)",
                borderRadius: "2px",
                marginTop: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${healthPercent}%`,
                  height: "100%",
                  backgroundColor:
                    healthPercent > 50 ? "#22c55e" : healthPercent > 25 ? "#eab308" : "#ef4444",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(PLAYER_MODEL_URL);
