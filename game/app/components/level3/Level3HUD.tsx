"use client";

import React from "react";
import { gameState } from "../../utils/gameState";

interface Level3HUDProps {
  qualifiedPlayerId: string;
  playerHP?: number;
  playerMaxHP?: number;
  playerLives?: number;
  astraHP?: number;
  astraMaxHP?: number;
  onAttack?: () => void;
}

export function Level3HUD({
  qualifiedPlayerId,
  playerHP = 100,
  playerMaxHP = 100,
  playerLives = 1,
  astraHP = 250,
  astraMaxHP = 250,
  onAttack,
}: Level3HUDProps) {
  const player = gameState.players[qualifiedPlayerId];
  const playerName = player?.name || "Player 1";
  const playerColor = player?.color || "#38bdf8";

  const playerHpPct = Math.max(0, Math.min(100, (playerHP / playerMaxHP) * 100));
  const astraHpPct = Math.max(0, Math.min(100, (astraHP / astraMaxHP) * 100));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: "420px",
        pointerEvents: "auto",
      }}
    >
      {/* ASTRA FINAL BOSS PROMINENT HEALTH BAR */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.92)",
          backdropFilter: "blur(12px)",
          border: "1.5px solid rgba(239, 68, 68, 0.5)",
          borderRadius: "12px",
          padding: "12px 16px",
          boxShadow: "0 10px 30px -5px rgba(239, 68, 68, 0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>👑</span>
            <span style={{ fontWeight: 900, fontSize: "14px", color: "#ef4444", letterSpacing: "1px" }}>
              ASTRA — FINAL BOSS
            </span>
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 800,
              color: "#fca5a5",
              fontFamily: "monospace",
            }}
          >
            {astraHP} / {astraMaxHP} HP
          </span>
        </div>

        {/* Boss HP Bar */}
        <div
          style={{
            height: "12px",
            backgroundColor: "rgba(30, 41, 59, 0.8)",
            borderRadius: "6px",
            overflow: "hidden",
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          <div
            style={{
              width: `${astraHpPct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #dc2626 0%, #ef4444 60%, #f87171 100%)",
              boxShadow: "0 0 12px rgba(239, 68, 68, 0.8)",
              transition: "width 0.25s ease-out",
            }}
          />
        </div>
      </div>

      {/* QUALIFIED CHALLENGER CARD & PLAYER HP / LIVES */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(12px)",
          border: `1.5px solid ${playerColor}55`,
          borderRadius: "12px",
          padding: "12px 16px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: playerColor,
                boxShadow: `0 0 10px ${playerColor}`,
              }}
            />
            <span style={{ fontWeight: 800, fontSize: "14px", color: "#ffffff" }}>{playerName}</span>
          </div>

          {/* LIVES COUNTER */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "4px 10px",
              borderRadius: "6px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8" }}>LIVES:</span>
            <span style={{ fontSize: "13px", fontWeight: 900, color: "#38bdf8", letterSpacing: "2px" }}>
              {"🛡️ ".repeat(Math.max(0, playerLives)).trim() || "0"}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#38bdf8" }}>
              ({playerLives}/1)
            </span>
          </div>
        </div>

        {/* Player HP Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              flex: 1,
              height: "8px",
              backgroundColor: "rgba(51, 65, 85, 0.8)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${playerHpPct}%`,
                height: "100%",
                backgroundColor:
                  playerHpPct > 50 ? "#22c55e" : playerHpPct > 25 ? "#eab308" : "#ef4444",
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#e2e8f0",
              fontFamily: "monospace",
              minWidth: "55px",
            }}
          >
            {playerHP} / {playerMaxHP}
          </span>
        </div>

        {/* COMBAT CONTROLS & ATTACK TRIGGER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "2px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
            <span>🎮 [WASD] Move | [ENTER / SPACE] Attack</span>
          </div>

          <button
            onClick={() => onAttack && onAttack()}
            style={{
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              border: "1px solid #38bdf8",
              borderRadius: "6px",
              padding: "6px 14px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              letterSpacing: "0.5px",
              boxShadow: "0 0 12px rgba(56, 189, 248, 0.4)",
              transition: "all 0.15s ease",
            }}
          >
            ⚔️ ATTACK [ENTER]
          </button>
        </div>
      </div>
    </div>
  );
}
