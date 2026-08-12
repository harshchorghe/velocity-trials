"use client";

import React, { useState } from "react";
import { formatTime, gameState } from "../utils/gameState";

interface CompletionVideoOverlayProps {
  player: {
    id: string;
    name: string;
    color: string;
    lives: number;
    stonesCollected: number;
    elapsedTimeSec: number;
    completionTimeFormatted?: string;
    qualificationRank?: number;
  };
  videoUrl?: string;
  onReset: () => void;
  onProceedToLevel3?: () => void;
}

export function CompletionVideoOverlay({
  player,
  videoUrl = gameState.completionVideoUrl || "/videos/level2-complete.mp4",
  onReset,
  onProceedToLevel3,
}: CompletionVideoOverlayProps) {
  const [videoError, setVideoError] = useState(false);

  const rankText = player.qualificationRank ? `#${player.qualificationRank}` : "";
  const timeTaken = player.completionTimeFormatted || formatTime(player.elapsedTimeSec);

  const handleProceedLevel3 = () => {
    if (onProceedToLevel3) {
      onProceedToLevel3();
    } else {
      window.location.href = "/game?level=3";
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 100,
        background: "rgba(15, 23, 42, 0.94)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(30, 41, 59, 0.95)",
          border: `2px solid ${player.color || "#10b981"}`,
          borderRadius: "20px",
          padding: "28px 36px",
          textAlign: "center",
          boxShadow: `0 0 60px ${player.color || "#10b981"}44`,
          maxWidth: "720px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          color: "#ffffff",
        }}
      >
        {/* Video Player Container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: "14px",
            overflow: "hidden",
            background: "#020617",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            marginBottom: "20px",
            minHeight: "220px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!videoError ? (
            <video
              src={videoUrl}
              autoPlay
              playsInline
              controls
              onError={() => setVideoError(true)}
              style={{
                width: "100%",
                maxHeight: "360px",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              <div style={{ fontSize: "42px", marginBottom: "8px" }}>🎬</div>
              <div style={{ fontWeight: 700, fontSize: "16px", color: "#f8fafc" }}>
                Level 2 Completion Cutscene
              </div>
              <div style={{ fontSize: "12px", marginTop: "6px", color: "#64748b" }}>
                Place completion video inside:{" "}
                <code style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" }}>
                  public{videoUrl}
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Completion Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ fontSize: "36px" }}>🏆</span>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 900,
              color: "#10b981",
              letterSpacing: "0.5px",
              textShadow: "0 0 16px rgba(16, 185, 129, 0.5)",
            }}
          >
            LEVEL 2 CLEARED!
          </h1>
        </div>

        <p style={{ color: "#cbd5e1", fontSize: "14px", margin: "0 0 20px 0" }}>
          Congratulations <strong>{player.name}</strong>! You unlocked <strong>Level 3 — The Final Showdown</strong>.
        </p>

        {/* Results Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>STONES</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8", marginTop: "4px" }}>
              3/3 💎
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>LIVES</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>
              {player.lives} ❤️
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>LEVEL 2 TIME</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>
              {timeTaken} ⏱️
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>TOTAL CAMPAIGN</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#00f0ff", marginTop: "4px" }}>
              {typeof window !== "undefined" && localStorage.getItem("tc_campaign_start_time")
                ? formatTime(Math.floor((Date.now() - parseInt(localStorage.getItem("tc_campaign_start_time") || "0", 10)) / 1000))
                : timeTaken} ⏱️
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={handleProceedLevel3}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #00f0ff 0%, #3b82f6 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "16px 24px",
              fontSize: "16px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 0 25px rgba(0, 240, 255, 0.5)",
              letterSpacing: "0.5px",
            }}
          >
            🚀 PROCEED TO LEVEL 3 — THE FINAL SHOWDOWN ›
          </button>
          <button
            onClick={onReset}
            style={{
              width: "100%",
              background: "rgba(255, 255, 255, 0.08)",
              color: "#94a3b8",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "12px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🔄 RESTART LEVEL 2
          </button>
        </div>
      </div>
    </div>
  );
}
