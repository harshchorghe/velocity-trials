"use client";

import React from "react";
import { gameState } from "../utils/gameState";

interface StoneNavigationWidgetProps {
  activeControlledId: string;
}

/**
 * Maps relative angle (-PI to PI) to a 360° compass directional arrow
 */
function getDirectionArrow(relAngle: number): string {
  let norm = relAngle % (2 * Math.PI);
  if (norm > Math.PI) norm -= 2 * Math.PI;
  if (norm < -Math.PI) norm += 2 * Math.PI;

  const deg = (norm * 180) / Math.PI;

  if (deg >= -22.5 && deg < 22.5) return "↑"; // Straight ahead
  if (deg >= 22.5 && deg < 67.5) return "↗"; // Ahead-Right
  if (deg >= 67.5 && deg < 112.5) return "→"; // Right
  if (deg >= 112.5 && deg < 157.5) return "↘"; // Behind-Right
  if (deg >= 157.5 || deg < -157.5) return "↓"; // Behind
  if (deg >= -157.5 && deg < -112.5) return "↙"; // Behind-Left
  if (deg >= -112.5 && deg < -67.5) return "←"; // Left
  if (deg >= -67.5 && deg < -22.5) return "↖"; // Ahead-Left

  return "↑";
}

export function StoneNavigationWidget({
  activeControlledId,
}: StoneNavigationWidgetProps) {
  const activePlayer =
    gameState.players[activeControlledId] || gameState.players["player-1"];

  if (!activePlayer) return null;

  // Don't render navigation if level completion/defeat screen is active
  if (activePlayer.status === "QUALIFIED" || activePlayer.status === "ELIMINATED") {
    return null;
  }

  // Filter assigned uncollected stones specifically for the active local player
  const assignedStones = Object.values(gameState.stones).filter(
    (s) => s.playerId === activePlayer.id
  );

  const uncollectedStones = assignedStones.filter((s) => !s.collected);

  // If all 3 assigned stones are collected, hide navigation completely
  if (uncollectedStones.length === 0) return null;

  const [px, , pz] = activePlayer.pos;

  return (
    <div
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        zIndex: 10,
        width: "240px",
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(56, 189, 248, 0.4)",
        borderRadius: "12px",
        padding: "12px 14px",
        color: "#ffffff",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header Title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          paddingBottom: "6px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.5px",
            color: "#38bdf8",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          📍 OBJECTIVE NAVIGATOR
        </span>
        <span
          style={{
            background: "rgba(56, 189, 248, 0.2)",
            color: "#38bdf8",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            padding: "1px 6px",
            borderRadius: "10px",
            fontSize: "10px",
            fontWeight: 800,
          }}
        >
          {activePlayer.stonesCollected || 0}/3
        </span>
      </div>

      {/* Uncollected Assigned Stones Direction List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {uncollectedStones.map((stone) => {
          const dx = stone.pos[0] - px;
          const dz = stone.pos[2] - pz;
          const dist = Math.hypot(dx, dz);

          // Angle from player position to stone in world coordinates
          const stoneAngle = Math.atan2(dx, dz);
          // Relative angle difference accounting for active camera view orientation
          const relAngle = stoneAngle - gameState.cameraYaw;
          const arrow = getDirectionArrow(relAngle);

          return (
            <div
              key={stone.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(30, 41, 59, 0.7)",
                border: `1px solid ${stone.color}55`,
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "11px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: stone.color,
                    boxShadow: `0 0 6px ${stone.color}`,
                  }}
                />
                <span style={{ fontWeight: 700, color: "#f8fafc" }}>
                  {stone.id}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>
                  {dist.toFixed(1)}m
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 900,
                    color: "#38bdf8",
                    display: "inline-block",
                    minWidth: "16px",
                    textAlign: "center",
                  }}
                >
                  {arrow}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
