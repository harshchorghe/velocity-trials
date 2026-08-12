"use client";

import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CollectibleStone } from "./CollectibleStone";
import { gameState } from "../utils/gameState";

import { reportCrystalCollected } from "../utils/api";

interface StoneManagerProps {
  onStonesStateChange?: () => void;
}

export function StoneManager({ onStonesStateChange }: StoneManagerProps) {
  const lastSyncTime = useRef<number>(0);
  const INTERACTION_DISTANCE = 2.5;

  // Listen for physical ENTER key press to trigger stone collection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.code === "Enter") {
        let collectedAny = false;
        const activePlayers = Object.values(gameState.players).filter(
          (p) => p.health > 0 && p.lives > 0
        );

        for (const player of activePlayers) {
          const [px, , pz] = player.pos;

          for (const stone of Object.values(gameState.stones)) {
            // Must belong to this player and not be collected
            if (stone.collected || stone.playerId !== player.id) continue;

            const [sx, , sz] = stone.pos;
            const distXZ = Math.hypot(px - sx, pz - sz);

            if (distXZ <= INTERACTION_DISTANCE) {
              const ok = gameState.collectStone(stone.id, player.id);
              if (ok) {
                collectedAny = true;
                const token = typeof window !== "undefined" ? localStorage.getItem("tc_token") || "" : "";
                const stoneIndex = parseInt(stone.id.replace(/\D/g, ""), 10) || 0;
                if (token) {
                  reportCrystalCollected(token, stoneIndex);
                }
                console.log(
                  `[ENTER COLLECTION SUCCESS] ${stone.id} collected by ${player.id}! Count: ${player.stonesCollected}/3`
                );
              }
            }
          }
        }

        if (collectedAny && onStonesStateChange) {
          onStonesStateChange();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onStonesStateChange]);

  // Frame loop updates proximity prompt status for nearby assigned stones
  useFrame((state) => {
    let stateChanged = false;
    const activePlayers = Object.values(gameState.players).filter(
      (p) => p.health > 0 && p.lives > 0
    );

    for (const stone of Object.values(gameState.stones)) {
      if (stone.collected) continue;

      const ownerPlayer = activePlayers.find((p) => p.id === stone.playerId);
      if (!ownerPlayer) {
        if (stone.isNearby) {
          stone.isNearby = false;
          stateChanged = true;
        }
        continue;
      }

      const [px, , pz] = ownerPlayer.pos;
      const [sx, , sz] = stone.pos;
      const distXZ = Math.hypot(px - sx, pz - sz);
      const isNearbyNow = distXZ <= INTERACTION_DISTANCE;

      if (stone.isNearby !== isNearbyNow) {
        stone.isNearby = isNearbyNow;
        stateChanged = true;
      }
    }

    const now = state.clock.elapsedTime * 1000;
    if (stateChanged || now - lastSyncTime.current > 100) {
      lastSyncTime.current = now;
      if (onStonesStateChange) {
        onStonesStateChange();
      }
    }
  });

  return (
    <group name="collectible-stones-container">
      {Object.values(gameState.stones).map((stone) => (
        <CollectibleStone key={stone.id} stone={stone} />
      ))}
    </group>
  );
}
