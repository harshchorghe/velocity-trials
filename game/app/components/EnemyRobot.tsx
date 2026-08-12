"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { gameState } from "../utils/gameState";

const ENEMY_MODEL_URL = "/models/enemy-robo.glb";

interface EnemyRobotProps {
  id: string;
}

export function EnemyRobot({ id }: EnemyRobotProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Load shared GLB asset
  const { scene: baseScene, animations } = useGLTF(ENEMY_MODEL_URL);

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

    const enemyData = gameState.enemies[id];
    if (!enemyData) return;

    // 1. Direct transform positioning (Zero lag / zero stutter)
    groupRef.current.position.set(enemyData.pos[0], enemyData.pos[1], enemyData.pos[2]);
    groupRef.current.rotation.y = enemyData.rotationY;

    // 2. Animation state trigger
    const reqAnim = (enemyData.activeAnim || "idle").toLowerCase().trim();
    if (reqAnim !== currentAnimRef.current) {
      currentAnimRef.current = reqAnim;

      let matchedName = names.find((n) => n.trim().toLowerCase() === reqAnim);
      if (!matchedName && (reqAnim === "attack" || reqAnim === "fight")) {
        matchedName = names.find((n) => {
          const nl = n.toLowerCase();
          return nl.includes("attack") || nl.includes("fight") || nl.includes("punch") || nl.includes("kick") || nl.includes("hit");
        });
      }
      if (!matchedName && reqAnim === "run") {
        matchedName = names.find((n) => n.toLowerCase().includes("run") || n.toLowerCase().includes("walk"));
      }
      if (!matchedName) {
        matchedName = names[0];
      }

      if (matchedName && actions[matchedName]) {
        Object.values(actions).forEach((act) => act?.fadeOut(0.15));
        actions[matchedName]?.reset().fadeIn(0.15).play();
      }
    }
  });

  const enemyData = gameState.enemies[id] || {
    name: id,
    color: "#ef4444",
    health: 120,
    maxHealth: 120,
    state: "idle",
    targetId: null,
  };

  const healthPercent = Math.max(0, Math.min(100, (enemyData.health / enemyData.maxHealth) * 100));

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
          position={[0, 1.7, 0]}
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
              border: `1px solid ${enemyData.color}`,
              borderRadius: "6px",
              padding: "2px 5px",
              boxShadow: `0 0 8px ${enemyData.color}44`,
              color: "#ffffff",
              fontFamily: "system-ui, sans-serif",
              fontSize: "9px",
              fontWeight: 600,
            }}
          >
            {/* Identity & Status */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: enemyData.color,
                  boxShadow: `0 0 4px ${enemyData.color}`,
                }}
              />
              <span style={{ color: "#f8fafc", fontWeight: 700 }}>{enemyData.name}</span>
              <span
                style={{
                  background:
                    enemyData.state === "combat"
                      ? "rgba(239, 68, 68, 0.3)"
                      : enemyData.state === "alert"
                      ? "rgba(234, 179, 8, 0.3)"
                      : "rgba(34, 197, 94, 0.2)",
                  color:
                    enemyData.state === "combat"
                      ? "#f87171"
                      : enemyData.state === "alert"
                      ? "#fde047"
                      : "#4ade80",
                  border: `1px solid ${
                    enemyData.state === "combat"
                      ? "rgba(239, 68, 68, 0.5)"
                      : enemyData.state === "alert"
                      ? "rgba(234, 179, 8, 0.5)"
                      : "rgba(34, 197, 94, 0.4)"
                  }`,
                  padding: "1px 3px",
                  borderRadius: "3px",
                  fontSize: "7px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                {enemyData.state}
              </span>
            </div>

            {/* Health Bar */}
            <div
              style={{
                width: "42px",
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
                  backgroundColor: enemyData.color,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            {/* Target & Distance */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                marginTop: "2px",
                fontSize: "8px",
                color: "#94a3b8",
                gap: "4px",
              }}
            >
              <span>
                Target:{" "}
                <strong style={{ color: enemyData.targetId ? "#38bdf8" : "#94a3b8" }}>
                  {enemyData.targetId || "None"}
                </strong>
              </span>
              {enemyData.distToTarget !== undefined && (
                <span>
                  Dist: <strong style={{ color: "#f8fafc" }}>{enemyData.distToTarget.toFixed(1)}m</strong>
                </span>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(ENEMY_MODEL_URL);
