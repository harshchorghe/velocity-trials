"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EnemyRobot } from "./EnemyRobot";
import { gameState, ATTACK_RANGE, ATTACK_COOLDOWN, ATTACK_DAMAGE } from "../utils/gameState";

interface EnemyManagerProps {
  onEnemiesStateChange?: () => void;
}

export function EnemyManager({ onEnemiesStateChange }: EnemyManagerProps) {
  const lastSyncTime = useRef<number>(0);

  const lastAiTickTime = useRef<number>(0);

  useFrame((state, delta) => {
    const allPlayers = Object.values(gameState.players);
    const activePlayers = allPlayers.filter((p) => p.health > 0 && p.lives > 0);
    const currentTimeSec = state.clock.elapsedTime;
    const nowMs = state.clock.elapsedTime * 1000;

    // AI Target Detection Throttled to 15 Hz (~66ms) for CPU optimization
    const isAiTick = nowMs - lastAiTickTime.current > 66;
    if (isAiTick) {
      lastAiTickTime.current = nowMs;
    }

    for (const enemy of Object.values(gameState.enemies)) {
      const [ex, ey, ez] = enemy.pos;

      let nearestPlayer: (typeof activePlayers)[0] | null = null;
      let minDist = Infinity;

      if (isAiTick) {
        for (const player of activePlayers) {
          const [px, , pz] = player.pos;
          const dist = Math.hypot(px - ex, pz - ez);
          if (dist < minDist) {
            minDist = dist;
            nearestPlayer = player;
          }
        }
      } else {
        // Reuse current target during intermediate frames
        nearestPlayer = enemy.targetId ? gameState.players[enemy.targetId] || null : null;
        if (nearestPlayer) {
          minDist = Math.hypot(nearestPlayer.pos[0] - ex, nearestPlayer.pos[2] - ez);
        }
      }

      let newState: "idle" | "alert" | "combat" = "idle";
      let targetId: string | null = null;
      let nextAnim = "idle";
      let newRotY = enemy.rotationY;
      let newX = ex;
      let newZ = ez;

      if (nearestPlayer && minDist <= gameState.detectionRange) {
        targetId = nearestPlayer.id;
        const [px, , pz] = nearestPlayer.pos;

        const dx = px - ex;
        const dz = pz - ez;
        const distLen = Math.hypot(dx, dz);

        if (distLen > 0.001) {
          newRotY = Math.atan2(dx, dz);
        }

        if (distLen <= ATTACK_RANGE) {
          newX = ex;
          newZ = ez;
          newState = "combat";
          nextAnim = "attack";

          if (currentTimeSec - (enemy.lastAttackTime || 0) >= ATTACK_COOLDOWN) {
            gameState.damagePlayer(nearestPlayer.id, ATTACK_DAMAGE);
            enemy.lastAttackTime = currentTimeSec;
          }
        } else {
          newState = "alert";
          nextAnim = "run";

          if (distLen > 0.05) {
            const normX = dx / distLen;
            const normZ = dz / distLen;
            const speed = 3.5;
            const moveDist = speed * delta;
            const candX = ex + normX * moveDist;
            const candZ = ez + normZ * moveDist;

            const [solidX, , solidZ] = gameState.validatePosition([ex, ey, ez], candX, candZ, 0.5);
            newX = solidX;
            newZ = solidZ;
          }
        }
      } else {
        newState = "idle";
        targetId = null;
        nextAnim = "idle";
      }

      const groundedY = gameState.getGroundHeight(newX, newZ, ey);

      enemy.pos = [newX, groundedY, newZ];
      enemy.rotationY = newRotY;
      enemy.state = newState;
      enemy.targetId = targetId;
      enemy.distToTarget = targetId ? minDist : undefined;
      enemy.activeAnim = nextAnim;
    }

    if (nowMs - lastSyncTime.current > 100) {
      lastSyncTime.current = nowMs;
      if (onEnemiesStateChange) {
        onEnemiesStateChange();
      }
    }
  });

  return (
    <group name="enemy-robots-container">
      {Object.keys(gameState.enemies).map((id) => (
        <EnemyRobot key={id} id={id} />
      ))}
    </group>
  );
}
