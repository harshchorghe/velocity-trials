"use client";

import React, { useEffect, useState } from "react";
import { formatTime } from "../utils/gameState";

export interface RoomLeaderboardProps {
  roomCode?: string;
  winnerName?: string;
  l3ElapsedTimeSec?: number;
  onClose?: () => void;
  onRestart?: () => void;
}

export function RoomLeaderboardModal({
  roomCode,
  winnerName,
  l3ElapsedTimeSec = 0,
  onClose,
  onRestart,
}: RoomLeaderboardProps) {
  const [roomData, setRoomData] = useState<any>(null);

  useEffect(() => {
    try {
      let rData = null;
      if (roomCode) {
        rData = JSON.parse(localStorage.getItem("vt_room_" + roomCode) || "null");
      }
      if (!rData) {
        rData = JSON.parse(localStorage.getItem("vt_current_room") || "null");
      }
      if (rData) {
        setRoomData(rData);
      }
    } catch (e) {}
  }, [roomCode]);

  // Sort players by status and least total time (ascending)
  const rawList = roomData?.players ? [...roomData.players] : null;
  if (rawList) {
    rawList.sort((a: any, b: any) => {
      const isCompA = a.status === "COMPLETED" || a.level3Status === "QUALIFIED" || a.isWinner;
      const isCompB = b.status === "COMPLETED" || b.level3Status === "QUALIFIED" || b.isWinner;
      if (isCompA && !isCompB) return -1;
      if (!isCompA && isCompB) return 1;
      const timeA = a.totalTimeSeconds || a.level3BossTime || a.level2Time || 999999;
      const timeB = b.totalTimeSeconds || b.level3BossTime || b.level2Time || 999999;
      return timeA - timeB;
    });
  }

  // Fallback players if room data is not found
  const players = rawList || [
    { slot: 1, name: winnerName || "Player 1 (Champion)", level3BossTime: l3ElapsedTimeSec, isWinner: true },
    { slot: 2, name: "Player 2 (Finalist)", level3BossTime: l3ElapsedTimeSec + 14.5 },
    { slot: 3, name: "Player 3", level2Status: "ELIMINATED" },
    { slot: 4, name: "Player 4", level1Status: "ELIMINATED" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(2, 6, 23, 0.96)",
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "'Orbitron', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(15, 23, 42, 0.98)",
          border: "2px solid #38bdf8",
          borderRadius: "24px",
          padding: "36px 44px",
          maxWidth: "650px",
          width: "100%",
          boxShadow: "0 0 70px rgba(56, 189, 248, 0.4)",
          color: "#ffffff",
          textAlign: "center",
        }}
      >
        {/* Header Icon & Title */}
        <div style={{ fontSize: "52px", lineHeight: 1, marginBottom: "8px" }}>🏆</div>
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 900,
            color: "#38bdf8",
            letterSpacing: "2px",
            textShadow: "0 0 20px rgba(56, 189, 248, 0.6)",
          }}
        >
          TOURNAMENT LEADERBOARD
        </h1>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", letterSpacing: "1px" }}>
          ROOM CODE: <strong style={{ color: "#fbbf24" }}>{roomData?.roomCode || roomCode || "VT-8921"}</strong>
        </div>

        <div
          style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.5), transparent)",
            margin: "20px 0",
          }}
        />

        {/* Champion Showcase Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%)",
            border: "1px solid #fbbf24",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "11px", color: "#fef08a", fontWeight: 700, letterSpacing: "1px" }}>
              👑 OVERALL CHAMPION
            </div>
            <div style={{ fontSize: "20px", fontWeight: 900, color: "#ffffff", marginTop: "2px" }}>
              {winnerName || roomData?.winnerName || players[0]?.name || "CHAMPION"}
            </div>
          </div>
          <div
            style={{
              background: "#fbbf24",
              color: "#0f172a",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: 900,
              fontSize: "14px",
            }}
          >
            ⏱️ {formatTime(l3ElapsedTimeSec || 125)}
          </div>
        </div>

        {/* 4 Player Standings List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
          {players.slice(0, 4).map((p: any, idx: number) => {
            const ranks = ["🥇 1st Place", "🥈 2nd Place", "🥉 3rd Place", "❌ 4th Place"];
            const rankColors = ["#fbbf24", "#cbd5e1", "#cd7f32", "#ef4444"];
            const isTop = idx === 0;

            return (
              <div
                key={idx}
                style={{
                  background: isTop ? "rgba(56, 189, 248, 0.12)" : "rgba(30, 41, 59, 0.6)",
                  border: isTop ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "12px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 900, color: rankColors[idx] }}>
                    {ranks[idx]}
                  </span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
                    {p.name || `Player ${p.slot || idx + 1}`}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>
                  {idx === 0
                    ? `Boss Defeated in ${formatTime(l3ElapsedTimeSec || 125)}`
                    : idx === 1
                    ? `Finalist (Runner Up)`
                    : idx === 2
                    ? `Eliminated in Level 2`
                    : `Eliminated in Level 1`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "12px" }}>
          {onRestart && (
            <button
              onClick={onRestart}
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                border: "none",
                borderRadius: "12px",
                padding: "14px 20px",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(56, 189, 248, 0.4)",
              }}
            >
              🔄 PLAY AGAIN
            </button>
          )}
          <button
            onClick={() => {
              if (onClose) onClose();
              else window.location.href = "/index.html";
            }}
            style={{
              flex: 1,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "12px",
              padding: "14px 20px",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🏠 RETURN TO LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}
