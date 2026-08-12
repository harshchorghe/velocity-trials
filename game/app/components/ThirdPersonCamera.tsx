"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameState } from "../utils/gameState";

// Configurable Third-Person Camera Parameters (Call of Duty style)
export const CAMERA_CONFIG = {
  CAMERA_DISTANCE: 5.0,
  CAMERA_HEIGHT: 2.5,
  CAMERA_LOOK_HEIGHT: 1.5,
  CAMERA_SMOOTHING: 10.0, // Lerp smoothing factor
};

interface ThirdPersonCameraProps {
  activeControlledId?: string;
}

export function ThirdPersonCamera({
  activeControlledId = "player-1",
}: ThirdPersonCameraProps) {
  // Reusable static buffers to prevent GC allocations in 60 FPS loop
  const currentCamPos = useRef(new THREE.Vector3(0, 15, 20));
  const currentLookAt = useRef(new THREE.Vector3(0, 1.5, 0));
  const raycaster = useRef(new THREE.Raycaster());
  const rayDir = useRef(new THREE.Vector3());
  const cameraYawRef = useRef(0);

  const isInitializedRef = useRef(false);

  useFrame((state, delta) => {
    const activePlayer =
      gameState.players[activeControlledId] || gameState.players["player-1"];
    if (!activePlayer) return;

    const [px, py, pz] = activePlayer.pos;
    const playerRotY = activePlayer.rotationY;

    // Target look-at point in front of player's facing direction
    const lookAheadDist = 2.0;
    const targetLookX = px + Math.sin(playerRotY) * lookAheadDist;
    const targetLookY = py + CAMERA_CONFIG.CAMERA_LOOK_HEIGHT;
    const targetLookZ = pz + Math.cos(playerRotY) * lookAheadDist;

    // Desired camera position directly behind the player's current facing direction
    let desiredDist = CAMERA_CONFIG.CAMERA_DISTANCE;
    const rawCamX = px - Math.sin(playerRotY) * desiredDist;
    const rawCamY = py + CAMERA_CONFIG.CAMERA_HEIGHT;
    const rawCamZ = pz - Math.cos(playerRotY) * desiredDist;

    // Camera Wall Collision Avoidance
    // Raycast from player look target toward raw camera position
    const lookVec = new THREE.Vector3(targetLookX, targetLookY, targetLookZ);
    const camVec = new THREE.Vector3(rawCamX, rawCamY, rawCamZ);
    rayDir.current.subVectors(camVec, lookVec).normalize();

    raycaster.current.set(lookVec, rayDir.current);
    raycaster.current.far = desiredDist;

    // Check collision with building bounding boxes
    if (gameState.buildingBoxes.length > 0) {
      let closestHit = desiredDist;
      for (const box of gameState.buildingBoxes) {
        const hit = raycaster.current.ray.intersectBox(box, new THREE.Vector3());
        if (hit) {
          const distToHit = lookVec.distanceTo(hit);
          if (distToHit < closestHit) {
            closestHit = distToHit;
          }
        }
      }
      if (closestHit < desiredDist) {
        desiredDist = Math.max(1.2, closestHit - 0.4);
      }
    }

    // Recalculate camera position with adjusted distance
    const finalTargetX = px - Math.sin(playerRotY) * desiredDist;
    const finalTargetY = py + CAMERA_CONFIG.CAMERA_HEIGHT;
    const finalTargetZ = pz - Math.cos(playerRotY) * desiredDist;

    // Snap to initial position on frame 1 to eliminate camera lag on startup
    if (!isInitializedRef.current) {
      currentCamPos.current.set(finalTargetX, finalTargetY, finalTargetZ);
      currentLookAt.current.set(targetLookX, targetLookY, targetLookZ);
      isInitializedRef.current = true;
    }

    // Smooth lerp interpolation for camera position & look-at target
    const damping = Math.min(1, delta * CAMERA_CONFIG.CAMERA_SMOOTHING);

    currentCamPos.current.x += (finalTargetX - currentCamPos.current.x) * damping;
    currentCamPos.current.y += (finalTargetY - currentCamPos.current.y) * damping;
    currentCamPos.current.z += (finalTargetZ - currentCamPos.current.z) * damping;

    currentLookAt.current.x += (targetLookX - currentLookAt.current.x) * damping;
    currentLookAt.current.y += (targetLookY - currentLookAt.current.y) * damping;
    currentLookAt.current.z += (targetLookZ - currentLookAt.current.z) * damping;

    // Apply smooth position and lookAt direction to camera
    state.camera.position.copy(currentCamPos.current);
    state.camera.lookAt(currentLookAt.current);

    // Calculate & publish active camera view yaw angle on XZ plane for navigation
    const camFwd = new THREE.Vector3();
    state.camera.getWorldDirection(camFwd);
    gameState.cameraYaw = Math.atan2(camFwd.x, camFwd.z);
  });

  return null;
}
