"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { onAgentsUpdate, AgentData } from "../utils/firebase";

export default function AdminPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAgentsUpdate((data) => {
      setAgents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatTime = (seconds?: number): string => {
    if (typeof seconds !== "number" || isNaN(seconds) || seconds < 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Search text match
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (agent.name && agent.name.toLowerCase().includes(q)) ||
        (agent.phone && agent.phone.toLowerCase().includes(q)) ||
        (agent.dept && agent.dept.toLowerCase().includes(q)) ||
        (agent.year && agent.year.toLowerCase().includes(q));

      // Status filter
      let matchStatus = true;
      if (statusFilter === "COMPLETED") matchStatus = agent.status === "COMPLETED";
      else if (statusFilter === "IN_PROGRESS") matchStatus = agent.status === "IN_PROGRESS" || agent.status === "QUALIFIED";
      else if (statusFilter === "FAILED") matchStatus = agent.status === "TIME_EXPIRED" || agent.status === "ELIMINATED";

      // Level filter
      let matchLevel = true;
      if (levelFilter !== "ALL") {
        matchLevel = String(agent.maxLevel || 1) === levelFilter;
      }

      return matchSearch && matchStatus && matchLevel;
    });
  }, [agents, searchQuery, statusFilter, levelFilter]);

  const topWinner = useMemo(() => {
    const completedList = agents.filter((a) => a.status === "COMPLETED");
    if (completedList.length > 0) return completedList[0];
    return agents.length > 0 ? agents[0] : null;
  }, [agents]);

  const exportToCSV = () => {
    const headers = ["Rank", "Agent Name", "Phone", "Branch/Dept", "Year", "Max Level Reached", "Status", "Total Time (Sec)", "Total Time (Formatted)"];
    const rows = filteredAgents.map((agent, idx) => [
      idx + 1,
      `"${agent.name || "Agent"}"`,
      `"${agent.phone || "N/A"}"`,
      `"${agent.dept || "CSE"}"`,
      `"${agent.year || "BE"}"`,
      `"Level ${agent.maxLevel || 1}"`,
      `"${agent.status || "IN_PROGRESS"}"`,
      agent.totalTimeSeconds ?? "",
      `"${formatTime(agent.totalTimeSeconds)}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `techchase_2k26_leaderboard_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#030712",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "32px 24px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header Title Section */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "28px" }}>🏆</span>
              <h1
                style={{
                  margin: 0,
                  fontSize: "26px",
                  fontWeight: 900,
                  background: "linear-gradient(90deg, #38bdf8 0%, #00f0ff 50%, #f59e0b 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "1px",
                }}
              >
                TECHCHASE 2K26 — OFFICIAL LEADERBOARD
              </h1>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
              Live Agent Rankings &amp; Campaign Performance Center • Sorted by Total Campaign Time
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={exportToCSV}
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              📥 EXPORT CSV
            </button>
            <Link
              href="/index.html"
              style={{
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              🏠 MAIN TERMINAL
            </Link>
          </div>
        </header>

        {/* Stats Overview Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          {/* Total Agents */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "14px",
              padding: "18px 20px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.5px" }}>TOTAL REGISTERED AGENTS</div>
            <div style={{ fontSize: "32px", fontWeight: 900, color: "#38bdf8", marginTop: "6px" }}>{agents.length}</div>
          </div>

          {/* Completed Campaigns */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "14px",
              padding: "18px 20px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.5px" }}>COMPLETED CAMPAIGNS</div>
            <div style={{ fontSize: "32px", fontWeight: 900, color: "#10b981", marginTop: "6px" }}>
              {agents.filter((a) => a.status === "COMPLETED").length}
            </div>
          </div>

          {/* Winner Spotlight */}
          <div
            style={{
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: "14px",
              padding: "18px 20px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 800, letterSpacing: "0.5px" }}>🥇 LEADERBOARD WINNER</div>
            {topWinner ? (
              <div style={{ marginTop: "6px" }}>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#ffffff" }}>{topWinner.name}</div>
                <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "2px" }}>
                  {topWinner.dept || "CSE"} • {formatTime(topWinner.totalTimeSeconds)} total
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "14px", color: "#94a3b8", marginTop: "6px" }}>No completions yet</div>
            )}
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Search Box */}
          <input
            type="text"
            placeholder="🔍 Search name, phone, branch, year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 2,
              minWidth: "220px",
              background: "#020617",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#ffffff",
              fontSize: "13px",
              outline: "none",
            }}
          />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              flex: 1,
              minWidth: "150px",
              background: "#020617",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#ffffff",
              fontSize: "13px",
              outline: "none",
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">🏆 Completed Only</option>
            <option value="IN_PROGRESS">⏱️ In Progress</option>
            <option value="FAILED">💀 Time Expired / Failed</option>
          </select>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              flex: 1,
              minWidth: "140px",
              background: "#020617",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#ffffff",
              fontSize: "13px",
              outline: "none",
            }}
          >
            <option value="ALL">All Levels</option>
            <option value="3">Level 3 (Final)</option>
            <option value="2">Level 2 (City)</option>
            <option value="1">Level 1 (Gestures)</option>
          </select>
        </div>

        {/* Leaderboard Table Container */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.88)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.6)",
          }}
        >
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#38bdf8", fontWeight: 700 }}>
              LOADING LEADERBOARD FROM FIREBASE...
            </div>
          ) : filteredAgents.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No agent records found matching your filters.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "rgba(30, 41, 59, 0.8)",
                      color: "#94a3b8",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      letterSpacing: "1px",
                    }}
                  >
                    <th style={{ padding: "14px 18px", width: "70px", textAlign: "center" }}>RANK</th>
                    <th style={{ padding: "14px 18px" }}>AGENT NAME</th>
                    <th style={{ padding: "14px 18px" }}>PHONE</th>
                    <th style={{ padding: "14px 18px" }}>BRANCH</th>
                    <th style={{ padding: "14px 18px" }}>YEAR</th>
                    <th style={{ padding: "14px 18px" }}>LEVEL</th>
                    <th style={{ padding: "14px 18px" }}>STATUS</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>TOTAL TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map((agent, index) => {
                    const isWinner = index === 0 && agent.status === "COMPLETED";
                    const rankDisplay = index === 0 ? "🥇 #1" : index === 1 ? "🥈 #2" : index === 2 ? "🥉 #3" : `#${index + 1}`;

                    return (
                      <tr
                        key={agent.id || index}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          background: isWinner ? "rgba(245, 158, 11, 0.08)" : index % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.02)",
                          transition: "background 0.2s ease",
                        }}
                      >
                        {/* Rank */}
                        <td
                          style={{
                            padding: "14px 18px",
                            textAlign: "center",
                            fontWeight: 800,
                            color: index === 0 ? "#f59e0b" : index === 1 ? "#cbd5e1" : index === 2 ? "#d97706" : "#94a3b8",
                          }}
                        >
                          {rankDisplay}
                        </td>

                        {/* Name */}
                        <td style={{ padding: "14px 18px", fontWeight: 700, color: "#ffffff" }}>
                          {agent.name || "Agent"}
                        </td>

                        {/* Phone */}
                        <td style={{ padding: "14px 18px", color: "#cbd5e1", fontFamily: "monospace" }}>
                          {agent.phone || "N/A"}
                        </td>

                        {/* Branch */}
                        <td style={{ padding: "14px 18px", color: "#38bdf8", fontWeight: 600 }}>
                          {agent.dept || "CSE"}
                        </td>

                        {/* Year */}
                        <td style={{ padding: "14px 18px", color: "#cbd5e1" }}>
                          {agent.year || "BE"}
                        </td>

                        {/* Max Level Reached */}
                        <td style={{ padding: "14px 18px", fontWeight: 700 }}>
                          <span
                            style={{
                              background: "rgba(56, 189, 248, 0.15)",
                              color: "#38bdf8",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                            }}
                          >
                            Level {agent.maxLevel || 1}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "14px 18px" }}>
                          {agent.status === "COMPLETED" ? (
                            <span
                              style={{
                                background: "rgba(34, 197, 94, 0.2)",
                                color: "#22c55e",
                                border: "1px solid rgba(34, 197, 94, 0.4)",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: 800,
                              }}
                            >
                              🏆 COMPLETED
                            </span>
                          ) : agent.status === "TIME_EXPIRED" || agent.status === "ELIMINATED" ? (
                            <span
                              style={{
                                background: "rgba(239, 68, 68, 0.2)",
                                color: "#ef4444",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: 800,
                              }}
                            >
                              💀 EXPIRED / FAILED
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "rgba(56, 189, 248, 0.2)",
                                color: "#38bdf8",
                                border: "1px solid rgba(56, 189, 248, 0.4)",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: 800,
                              }}
                            >
                              ⏱️ IN PROGRESS
                            </span>
                          )}
                        </td>

                        {/* Total Campaign Time (Primary Sorting Metric) */}
                        <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800 }}>
                          <span
                            style={{
                              color: isWinner ? "#f59e0b" : "#00f0ff",
                              fontSize: "15px",
                              fontFamily: "monospace",
                            }}
                          >
                            ⏱️ {formatTime(agent.totalTimeSeconds)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
