"use client";

import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { gameState } from "../utils/gameState";

export type GestureType =
  | "NONE"
  | "MOVE_FORWARD"
  | "MOVE_BACKWARD"
  | "STOP"
  | "JUMP"
  | "SPRINT"
  | "MOVE_LEFT"
  | "MOVE_RIGHT";

interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export function GestureController() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Initializing Camera...");
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [detectedGesture, setDetectedGesture] = useState<string>("NONE");
  const [fingerState, setFingerState] = useState<FingerState>({
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  });

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Stream & Lifecycle refs
  const isMountedRef = useRef<boolean>(true);
  const isInitializingRef = useRef<boolean>(false);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Debouncing refs & dropout buffer refs
  const candidateGestureRef = useRef<string>("NONE");
  const candidateTimestampRef = useRef<number>(0);
  const activeGestureRef = useRef<string>("NONE");
  const lastMovementTimeRef = useRef<number>(0);
  const lastActiveMovementGestureRef = useRef<GestureType>("NONE");

  // Initialize MediaPipe HandLandmarker
  const initLandmarker = async () => {
    try {
      setIsLoading(true);
      setStatusText("Loading MediaPipe AI...");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      if (!isMountedRef.current) return false;

      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      if (!isMountedRef.current) return false;

      landmarkerRef.current = landmarker;
      setStatusText("MediaPipe Ready");
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("Failed to initialize MediaPipe HandLandmarker:", err);
      if (isMountedRef.current) {
        setStatusText("AI Load Failed");
        setIsLoading(false);
      }
      return false;
    }
  };

  // Start Webcam Stream automatically
  const startCamera = async () => {
    if (isInitializingRef.current) return;
    if (activeStreamRef.current && activeStreamRef.current.active) return;

    isInitializingRef.current = true;
    setIsLoading(true);
    setPermissionDenied(false);
    setStatusText("Requesting Camera Permission...");

    try {
      if (!landmarkerRef.current) {
        const ok = await initLandmarker();
        if (!ok) {
          isInitializingRef.current = false;
          return;
        }
      }

      if (!isMountedRef.current) {
        isInitializingRef.current = false;
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { ideal: 30 } },
      });

      // If component was unmounted while waiting for user prompt:
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        isInitializingRef.current = false;
        return;
      }

      activeStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsEnabled(true);
        setStatusText("Camera Live — Tracking Gestures");
        startDetectionLoop();
      }
    } catch (err) {
      console.error("Camera access denied or error:", err);
      if (isMountedRef.current) {
        setPermissionDenied(true);
        setStatusText("Camera Access Denied");
        setIsEnabled(false);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isInitializingRef.current = false;
    }
  };

  // Stop Webcam Stream & cleanup tracks
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    setIsEnabled(false);
    setStatusText("Camera Stopped");
    setDetectedGesture("NONE");

    // Clear gesture commands in gameState
    gameState.setGestureState({
      rawGesture: "NONE",
      activeGesture: "NONE",
      forward: false,
      left: false,
      right: false,
      sprint: false,
      stop: false,
      jumpPulse: false,
    });
  };

  // 3D Distance helper
  const dist3D = (p1: { x: number; y: number; z?: number }, p2: { x: number; y: number; z?: number }) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.hypot(dx, dy, dz);
  };

  // Process video frames & classify gestures
  const processFrame = (timestamp: number) => {
    if (!videoRef.current || !landmarkerRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    const now = timestamp;
    const results = landmarkerRef.current.detectForVideo(video, now);

    let rawGesture: GestureType = "NONE";
    let fingers: FingerState = {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    };

    if (results.landmarks && results.landmarks.length > 0) {
      const lm = results.landmarks[0];
      const wrist = lm[0];

      // Distance from wrist to joints
      const dIndexTip = dist3D(lm[8], wrist);
      const dIndexPip = dist3D(lm[6], wrist);

      const dMiddleTip = dist3D(lm[12], wrist);
      const dMiddlePip = dist3D(lm[10], wrist);

      const dRingTip = dist3D(lm[16], wrist);
      const dRingPip = dist3D(lm[14], wrist);

      const dPinkyTip = dist3D(lm[20], wrist);
      const dPinkyPip = dist3D(lm[18], wrist);

      const dThumbTip = dist3D(lm[4], lm[17]); // Thumb tip to pinky MCP
      const dThumbMcp = dist3D(lm[2], lm[17]);

      // 3D & 2D Anatomical Finger Extension Ratio Checks (Angle & Camera-Tilt Independent)
      const indexExtended = dIndexTip > dIndexPip * 1.05 && (lm[8].y < lm[6].y + 0.08 || dIndexTip > dIndexPip * 1.15);
      const middleExtended = dMiddleTip > dMiddlePip * 1.05 && (lm[12].y < lm[10].y + 0.08 || dMiddleTip > dMiddlePip * 1.15);
      const ringExtended = dRingTip > dRingPip * 1.05 && (lm[16].y < lm[14].y + 0.08 || dRingTip > dRingPip * 1.15);
      const pinkyExtended = dPinkyTip > dPinkyPip * 1.05 && (lm[20].y < lm[18].y + 0.08 || dPinkyTip > dPinkyPip * 1.15);
      const thumbExtended = dThumbTip > dThumbMcp * 1.12;

      fingers = {
        thumb: thumbExtended,
        index: indexExtended,
        middle: middleExtended,
        ring: ringExtended,
        pinky: pinkyExtended,
      };

      // Classify Exact Gestures based on specification
      if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        // GESTURE 1 — OPEN PALM 🖐️ (All main 4 or 5 fingers extended)
        rawGesture = "MOVE_FORWARD";
      } else if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        // GESTURE 2 — CLOSED FIST ✊
        rawGesture = "STOP";
      } else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        // GESTURE 3 — INDEX FINGER UP ☝️
        rawGesture = "JUMP";
      } else if (thumbExtended && !indexExtended && !middleExtended && !ringExtended) {
        // GESTURE 4 — THUMB (T) -> MOVE_LEFT 👈
        rawGesture = "MOVE_LEFT";
      } else if (pinkyExtended && !indexExtended && !middleExtended && !ringExtended) {
        // GESTURE 5 — PINKY (P) -> MOVE_RIGHT 👉
        rawGesture = "MOVE_RIGHT";
      } else {
        // Hand X-Position Horizontal Movement with Center Deadzone (0.42 <= wrist.x <= 0.58)
        const wristX = wrist.x;
        if (wristX > 0.58) {
          rawGesture = "MOVE_LEFT";
        } else if (wristX < 0.42) {
          rawGesture = "MOVE_RIGHT";
        }
      }
    }

    setFingerState(fingers);

    const isMovementGesture = (g: GestureType) =>
      g === "MOVE_LEFT" || g === "MOVE_RIGHT" || g === "MOVE_FORWARD" || g === "MOVE_BACKWARD" || g === "SPRINT";

    // 1. Vision Dropout Grace Period (120ms buffer for transient frame loss)
    if (isMovementGesture(rawGesture)) {
      lastMovementTimeRef.current = now;
      lastActiveMovementGestureRef.current = rawGesture;
    } else if (rawGesture === "NONE" && isMovementGesture(lastActiveMovementGestureRef.current)) {
      if (now - lastMovementTimeRef.current < 120) {
        rawGesture = lastActiveMovementGestureRef.current;
      } else {
        lastActiveMovementGestureRef.current = "NONE";
      }
    } else if (rawGesture === "STOP") {
      lastActiveMovementGestureRef.current = "NONE";
    }

    // 2. State Synchronization & Immediate Brake/Stop Handling
    const isImmediateState = rawGesture === "STOP" || rawGesture === "NONE";

    if (isImmediateState) {
      candidateGestureRef.current = rawGesture;
      candidateTimestampRef.current = now;
      if (activeGestureRef.current !== rawGesture) {
        activeGestureRef.current = rawGesture;
        setDetectedGesture(rawGesture);
        gameState.setGestureState({
          rawGesture,
          activeGesture: rawGesture,
          forward: false,
          backward: false,
          left: false,
          right: false,
          sprint: false,
          stop: rawGesture === "STOP",
          jumpPulse: false,
        });
      }
    } else {
      // 60ms Fast Stabilization Debounce for Active Movement / Action Gestures
      if (rawGesture !== candidateGestureRef.current) {
        candidateGestureRef.current = rawGesture;
        candidateTimestampRef.current = now;
      } else if (now - candidateTimestampRef.current >= 60 || activeGestureRef.current !== rawGesture) {
        const prevActive = activeGestureRef.current;
        activeGestureRef.current = rawGesture;
        setDetectedGesture(rawGesture);

        let jumpPulseTrigger = false;
        if (prevActive !== "JUMP" && rawGesture === "JUMP") {
          jumpPulseTrigger = true;
          gameState.triggerJumpPulse();
        }

        gameState.setGestureState({
          rawGesture,
          activeGesture: rawGesture,
          forward: rawGesture === "MOVE_FORWARD",
          backward: rawGesture === "MOVE_BACKWARD",
          left: rawGesture === "MOVE_LEFT",
          right: rawGesture === "MOVE_RIGHT",
          sprint: rawGesture === "SPRINT",
          stop: rawGesture === "STOP",
          jumpPulse: jumpPulseTrigger,
        });
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  };

  const startDetectionLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(processFrame);
  };

  // Automatically start camera on mount, stop on unmount
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();

    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, []);

  return (
    <>
      <div
        style={{
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "12px",
          padding: "12px",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>🖐️</span>
            <span style={{ fontSize: "13px", fontWeight: 700 }}>AI Gesture Control</span>
          </div>

          {/* Status Indicator Badge (No Enable Camera button) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: isEnabled
                ? "rgba(34, 197, 94, 0.15)"
                : permissionDenied
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(56, 189, 248, 0.15)",
              border: `1px solid ${
                isEnabled
                  ? "rgba(34, 197, 94, 0.4)"
                  : permissionDenied
                  ? "rgba(239, 68, 68, 0.4)"
                  : "rgba(56, 189, 248, 0.4)"
              }`,
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "10px",
              fontWeight: 800,
              color: isEnabled ? "#4ade80" : permissionDenied ? "#f87171" : "#38bdf8",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: isEnabled ? "#22c55e" : permissionDenied ? "#ef4444" : "#38bdf8",
                boxShadow: `0 0 6px ${isEnabled ? "#22c55e" : permissionDenied ? "#ef4444" : "#38bdf8"}`,
              }}
            />
            <span>{isEnabled ? "LIVE" : permissionDenied ? "DENIED" : "STARTING..."}</span>
          </div>
        </div>

        {/* Video Preview Container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: isEnabled ? "140px" : "0px",
            overflow: "hidden",
            borderRadius: "8px",
            background: "#090d16",
            transition: "height 0.3s ease",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)", // Mirror video preview
            }}
          />

          {/* Live Detected Gesture Overlay Badge */}
          {isEnabled && (
            <div
              style={{
                position: "absolute",
                bottom: "8px",
                left: "8px",
                background: "rgba(15, 23, 42, 0.85)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: 800,
                color: "#38bdf8",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>ACTIVE:</span>
              <span style={{ color: "#ffffff" }}>
                {detectedGesture === "MOVE_FORWARD"
                  ? "🖐️ MOVE FORWARD"
                  : detectedGesture === "STOP"
                  ? "✊ STOP"
                  : detectedGesture === "JUMP"
                  ? "☝️ JUMP"
                  : detectedGesture === "MOVE_LEFT"
                  ? "👈 MOVE LEFT (THUMB T)"
                  : detectedGesture === "MOVE_RIGHT"
                  ? "👉 MOVE RIGHT (PINKY P)"
                  : "NONE"}
              </span>
            </div>
          )}
        </div>

        {/* Status & Finger Diagnostics */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#94a3b8" }}>
          <span>Status: <strong style={{ color: isEnabled ? "#4ade80" : permissionDenied ? "#ef4444" : "#38bdf8" }}>{statusText}</strong></span>

          {/* Finger Extended Badges */}
          <div style={{ display: "flex", gap: "3px" }}>
            {[
              { label: "T", active: fingerState.thumb },
              { label: "I", active: fingerState.index },
              { label: "M", active: fingerState.middle },
              { label: "R", active: fingerState.ring },
              { label: "P", active: fingerState.pinky },
            ].map((f, i) => (
              <span
                key={i}
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9px",
                  fontWeight: 800,
                  background: f.active ? "#38bdf8" : "rgba(51, 65, 85, 0.6)",
                  color: f.active ? "#0f172a" : "#64748b",
                }}
              >
                {f.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Centered Camera Permission Denied Modal */}
      {permissionDenied && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
            background: "rgba(2, 6, 23, 0.92)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              background: "rgba(15, 23, 42, 0.96)",
              border: "2px solid #ef4444",
              borderRadius: "16px",
              padding: "36px 44px",
              textAlign: "center",
              maxWidth: "520px",
              width: "min(90vw, 520px)",
              boxShadow: "0 0 50px rgba(239, 68, 68, 0.4)",
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div style={{ fontSize: "52px", lineHeight: 1 }}>📷⚠️</div>
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 900,
                color: "#ef4444",
                letterSpacing: "1px",
              }}
            >
              CAMERA PERMISSION REQUIRED
            </h2>
            <p style={{ margin: 0, fontSize: "14px", color: "#cbd5e1", lineHeight: 1.6 }}>
              Level 2 requires mandatory <strong>AI Gesture Control</strong> to play.
              <br />
              Please allow camera access in your browser settings to enable gesture movement controls for Level 2.
            </p>
            <button
              onClick={startCamera}
              disabled={isLoading}
              style={{
                background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "12px 28px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: isLoading ? "wait" : "pointer",
                boxShadow: "0 0 20px rgba(56, 189, 248, 0.4)",
                transition: "all 0.2s ease",
              }}
            >
              {isLoading ? "REQUESTING PERMISSION..." : "ALLOW / RETRY CAMERA ACCESS"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
