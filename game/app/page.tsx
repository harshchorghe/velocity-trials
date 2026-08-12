"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/index.html";
    }
  }, []);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#050811",
      color: "#00f0ff",
      fontFamily: "Orbitron, sans-serif"
    }}>
      <h2>INITIALIZING VELOCITY TRAILS TERMINAL...</h2>
    </div>
  );
}