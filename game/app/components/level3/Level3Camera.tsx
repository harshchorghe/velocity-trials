"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ArenaInfo } from "./Level3Map";

interface Level3CameraProps {
  arenaInfo?: ArenaInfo | null;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  astraPosRef?: React.MutableRefObject<THREE.Vector3>;
  playerRotYRef?: React.MutableRefObject<number>;
}

export function Level3Camera({ arenaInfo, playerPosRef, astraPosRef, playerRotYRef }: Level3CameraProps) {
  const currentCamPos = useRef(new THREE.Vector3(0, 5, 14));
  const currentLookAt = useRef(new THREE.Vector3(0, 1.5, 8));

  useFrame((state, delta) => {
    if (playerPosRef?.current) {
      const px = playerPosRef.current.x;
      const py = playerPosRef.current.y;
      const pz = playerPosRef.current.z;
      const rotY = playerRotYRef?.current ?? Math.PI;

      // Third-Person Camera Parameters matching Level 2 Call of Duty reference style
      const CAMERA_DISTANCE = 5.5;  // Distance behind player
      const CAMERA_HEIGHT = 2.6;    // Height above player
      const LOOK_HEIGHT = 1.6;      // Look-at height at upper body / head

      const targetLookX = px;
      const targetLookY = py + LOOK_HEIGHT;
      const targetLookZ = pz;

      // Calculate camera position behind the player based on player's orientation angle rotY
      const rawCamX = px - Math.sin(rotY) * CAMERA_DISTANCE;
      const rawCamY = py + CAMERA_HEIGHT;
      const rawCamZ = pz - Math.cos(rotY) * CAMERA_DISTANCE;

      // Smooth lerp interpolation matching Level 2
      const safeDelta = Math.min(0.05, delta);
      const damping = Math.min(1.0, safeDelta * 10.0);

      currentCamPos.current.x += (rawCamX - currentCamPos.current.x) * damping;
      currentCamPos.current.y += (rawCamY - currentCamPos.current.y) * damping;
      currentCamPos.current.z += (rawCamZ - currentCamPos.current.z) * damping;

      currentLookAt.current.x += (targetLookX - currentLookAt.current.x) * damping;
      currentLookAt.current.y += (targetLookY - currentLookAt.current.y) * damping;
      currentLookAt.current.z += (targetLookZ - currentLookAt.current.z) * damping;

      state.camera.position.copy(currentCamPos.current);
      state.camera.lookAt(currentLookAt.current);
    }
  });

  return null;
}
