"use client";

import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Player } from "./Player";
import * as THREE from "three";
import { gameState } from "../utils/gameState";

interface MultiplayerManagerProps {
  activeControlledId?: string;
  onPlayersStateChange?: () => void;
}

export function MultiplayerManager({
  activeControlledId = "player-1",
  onPlayersStateChange,
}: MultiplayerManagerProps) {
  const keysPressed = useRef<Record<string, boolean>>({});
  const lastSyncTime = useRef<number>(0);
  const referenceCamAngleRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    // 1. Update real-time Level 2 timers for playing players
    gameState.updatePlayerTimers(delta);

    // 2. Ground all players continuously to map height
    for (const p of Object.values(gameState.players)) {
      const gY = gameState.getGroundHeight(p.pos[0], p.pos[2], p.pos[1]);
      p.pos[1] = gY;
    }

    const activePlayer = gameState.players[activeControlledId];
    if (!activePlayer) return;

    // 3. Disable controls if ELIMINATED or QUALIFIED
    if (activePlayer.status === "ELIMINATED" || activePlayer.lives <= 0) {
      activePlayer.activeAnim = "death";
      return;
    }
    if (activePlayer.status === "QUALIFIED") {
      activePlayer.activeAnim = "idle";
      return;
    }

    const keys = keysPressed.current;
    const gesture = gameState.gestureState;

    // 1. Calculate Camera-Relative Direction Vectors on XZ Ground Plane
    const liveCamFwd = new THREE.Vector3();
    state.camera.getWorldDirection(liveCamFwd);
    liveCamFwd.y = 0;
    const currentCamAngle = liveCamFwd.lengthSq() > 0.0001
      ? Math.atan2(liveCamFwd.x, liveCamFwd.z)
      : activePlayer.rotationY;

    // 2. Unify WASD + Gesture Inputs into camera-relative directional intent
    const isStopped = gesture.stop;

    const gestureSteerLeft = gesture.left && !isStopped;
    const gestureSteerRight = gesture.right && !isStopped;

    // Include forward momentum when steering left/right via gestures for smooth curve turning
    const rawFwd = !isStopped && (keys["w"] || keys["arrowup"] || gesture.forward || gestureSteerLeft || gestureSteerRight) ? 1 : 0;
    const rawBack = !isStopped && (keys["s"] || keys["arrowdown"] || gesture.backward) ? 1 : 0;

    let rawLeft = 0;
    if (!isStopped) {
      if (keys["a"] || keys["arrowleft"]) rawLeft += 1;
      if (gestureSteerLeft) rawLeft += 0.45; // 0.45 ratio produces a smooth ~24° slight curve turn
    }

    let rawRight = 0;
    if (!isStopped) {
      if (keys["d"] || keys["arrowright"]) rawRight += 1;
      if (gestureSteerRight) rawRight += 0.45; // 0.45 ratio produces a smooth ~24° slight curve turn
    }

    const inputFwd = rawFwd - rawBack;   // +1 for camera-forward, -1 for camera-backward
    const inputSide = rawRight - rawLeft; // +0.45 / +1 for right, -0.45 / -1 for left
    const isInputActive = inputFwd !== 0 || inputSide !== 0;

    // Lock camera reference angle at start of movement stroke to prevent feedback loop
    if (!isInputActive) {
      referenceCamAngleRef.current = currentCamAngle;
    } else if (referenceCamAngleRef.current === null) {
      referenceCamAngleRef.current = currentCamAngle;
    }

    const refAngle = referenceCamAngleRef.current ?? currentCamAngle;
    const camFwd = new THREE.Vector3(Math.sin(refAngle), 0, Math.cos(refAngle)).normalize();
    const camRight = new THREE.Vector3(camFwd.z, 0, -camFwd.x).normalize();

    const moveVector = new THREE.Vector3();
    if (isInputActive) {
      moveVector.addScaledVector(camFwd, inputFwd);
      moveVector.addScaledVector(camRight, inputSide);
      moveVector.normalize(); // Normalized so diagonal movement is NOT faster
    }

    const isSprinting = !!keys["shift"] || (gesture.sprint && !gesture.stop);
    const isAttacking = !!keys["e"];
    const isJumping = !!keys[" "] || gesture.jumpPulse;
    if (gesture.jumpPulse) {
      gameState.clearJumpPulse();
    }

    const moving = isInputActive && moveVector.lengthSq() > 0.001;

    let nextAnim = "idle";
    if (isAttacking) {
      nextAnim = "attack";
    } else if (isJumping) {
      nextAnim = "jump";
    } else if (moving) {
      nextAnim = isSprinting ? "run" : "walking";
    }

    // Smooth character rotation toward target movement direction (rotates ONCE and stops)
    let newRotY = activePlayer.rotationY;
    if (moving) {
      const targetRotY = Math.atan2(moveVector.x, moveVector.z);
      let diff = targetRotY - activePlayer.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      // Stop rotating when close to target angle
      if (Math.abs(diff) < 0.01) {
        newRotY = targetRotY;
      } else {
        newRotY = activePlayer.rotationY + diff * Math.min(1, delta * 12);
      }
    }

    const speed = isSprinting ? 7.5 : 4.2;
    const moveDist = speed * delta;

    const currPos = activePlayer.pos;
    let newX = currPos[0];
    let newZ = currPos[2];

    if (moving) {
      const candX = currPos[0] + moveVector.x * moveDist;
      const candZ = currPos[2] + moveVector.z * moveDist;

      // Validate building collisions & map boundary limits
      const [solidX, , solidZ] = gameState.validatePosition(currPos, candX, candZ, 0.5);
      newX = solidX;
      newZ = solidZ;
    }

    const groundedY = gameState.getGroundHeight(newX, newZ, currPos[1]);

    // Update real-time gameState
    activePlayer.pos = [newX, groundedY, newZ];
    activePlayer.rotationY = newRotY;
    activePlayer.activeAnim = nextAnim;

    // Trigger HUD update every 100ms
    const now = state.clock.elapsedTime * 1000;
    if (now - lastSyncTime.current > 100) {
      lastSyncTime.current = now;
      if (onPlayersStateChange) {
        onPlayersStateChange();
      }
    }
  });

  return (
    <group name="multiplayer-players-container">
      {Object.keys(gameState.players)
        .filter((id) => id === activeControlledId)
        .map((id) => (
          <Player key={id} id={id} />
        ))}
    </group>
  );
}
