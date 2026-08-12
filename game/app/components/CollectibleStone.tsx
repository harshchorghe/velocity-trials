"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { StoneData, gameState } from "../utils/gameState";

interface CollectibleStoneProps {
  stone: StoneData;
}

export function CollectibleStone({ stone }: CollectibleStoneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.5;
      meshRef.current.position.y =
        stone.pos[1] + 0.6 + Math.sin(state.clock.elapsedTime * 2.5) * 0.12;
    }
  });

  if (stone.collected) return null;

  const ownerLabel =
    stone.playerId === "player-1"
      ? "P1 Only"
      : stone.playerId === "player-2"
      ? "P2 Only"
      : "P3 Only";

  const activeLocalPlayer =
    Object.values(gameState.players).find((p) => p.isLocalPlayer) || gameState.players["player-1"];
  const isCompletionActive =
    activeLocalPlayer && (activeLocalPlayer.status === "QUALIFIED" || activeLocalPlayer.status === "ELIMINATED");

  return (
    <group ref={groupRef} position={[stone.pos[0], 0, stone.pos[2]]}>
      {/* 3D Crystal Gem Mesh */}
      <mesh ref={meshRef} position={[0, stone.pos[1] + 0.6, 0]} castShadow>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={stone.color}
          emissive={stone.color}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Gem Glow PointLight */}
      <pointLight
        position={[0, stone.pos[1] + 0.6, 0]}
        color={stone.color}
        intensity={2.5}
        distance={3.5}
      />

      {/* Overhead 3D HUD Badge — Hidden when Level 2 completion screen is active */}
      {!isCompletionActive && (
        <Html
          position={[0, stone.pos[1] + 1.6, 0]}
          center
          distanceFactor={16}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(6px)",
              border: `1.5px solid ${stone.color}`,
              borderRadius: "6px",
              padding: "2px 6px",
              boxShadow: `0 0 10px ${stone.color}55`,
              color: "#ffffff",
              fontFamily: "system-ui, sans-serif",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span>💎</span>
              <span style={{ color: "#f8fafc" }}>{stone.id}</span>
              <span
                style={{
                  background: `${stone.color}33`,
                  color: stone.color,
                  border: `1px solid ${stone.color}66`,
                  padding: "1px 4px",
                  borderRadius: "4px",
                  fontSize: "8px",
                  fontWeight: 800,
                }}
              >
                {ownerLabel}
              </span>
            </div>

            {/* Interactive Collection Prompt */}
            {stone.isNearby && (
              <div
                style={{
                  marginTop: "4px",
                  background: "#38bdf8",
                  color: "#0f172a",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "9px",
                  fontWeight: 900,
                  letterSpacing: "0.5px",
                  boxShadow: "0 0 10px #38bdf8",
                  animation: "pulse 1s infinite alternate",
                }}
              >
                ⌨️ PRESS ENTER TO COLLECT
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
