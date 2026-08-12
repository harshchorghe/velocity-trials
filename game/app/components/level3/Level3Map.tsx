"use client";

import React, { useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const LEVEL3_MAP_URL = "/models/level3-map.glb";

/**
 * Arena geometry metadata computed from the actual GLB bounding box,
 * exported so players/boss/camera can be placed relative to the real arena.
 */
export interface ArenaInfo {
  /** World-space Y of the arena floor (entities stand on this) */
  floorY: number;
  /** World-space center of the arena (X, Y-center, Z) */
  centerX: number;
  centerZ: number;
  /** Radius of playable black circular arena floor */
  radius: number;
  /** World-space half-extents of the arena on the XZ plane */
  halfWidth: number;   // half of X extent
  halfDepth: number;   // half of Z extent
  /** World-space top Y */
  ceilingY: number;
}

interface Level3MapProps {
  onArenaReady?: (info: ArenaInfo, mapScene?: THREE.Object3D) => void;
}

export function Level3Map({ onArenaReady }: Level3MapProps) {
  const { scene } = useGLTF(LEVEL3_MAP_URL);

  const { clonedScene, offsetPos, targetScale, arenaInfo } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);

    const fullBox = new THREE.Box3();
    const arenaBox = new THREE.Box3();
    const floorBox = new THREE.Box3();

    // Enforce DoubleSide rendering & shadow casting across sub-mesh materials
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;

        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              m.side = THREE.DoubleSide;
            });
          } else {
            mesh.material.side = THREE.DoubleSide;
          }
        }

        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
        if (mesh.geometry.boundingBox) {
          const meshBox = mesh.geometry.boundingBox.clone();
          meshBox.applyMatrix4(mesh.matrixWorld);

          const name = mesh.name.toLowerCase();
          if (!name.includes("sky") && !name.includes("sphere_sky")) {
            arenaBox.union(meshBox);
          }
          if (name.includes("arena floor") || name.includes("arena_floor") || name.includes("polygon56")) {
            floorBox.union(meshBox);
          }
          fullBox.union(meshBox);
        }
      }
    });

    const targetBox = arenaBox.isEmpty() ? fullBox : arenaBox;
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    targetBox.getCenter(center);
    targetBox.getSize(size);

    // Normalize map scale to a 50-meter wide boss arena floor
    const maxDim = Math.max(size.x, size.z);
    const scale = maxDim > 0 ? 50.0 / maxDim : 1.0;

    // Offset position to align map center at X=0, Z=0 and lowest foundation at Y=0
    const offsetX = -center.x * scale;
    const offsetY = -targetBox.min.y * scale;
    const offsetZ = -center.z * scale;

    const worldMinX = targetBox.min.x * scale + offsetX;
    const worldMaxX = targetBox.max.x * scale + offsetX;
    const worldMinZ = targetBox.min.z * scale + offsetZ;
    const worldMaxZ = targetBox.max.z * scale + offsetZ;

    // Detect actual top surface elevation of the black circular arena floor mesh
    const floorMaxY = !floorBox.isEmpty() ? floorBox.max.y : targetBox.min.y;
    const worldFloorY = floorMaxY * scale + offsetY;
    const worldCeilY = targetBox.max.y * scale + offsetY;

    const halfWidth = (worldMaxX - worldMinX) / 2;
    const halfDepth = (worldMaxZ - worldMinZ) / 2;
    // The central black circular arena floor spans ~65% of the total model radius
    const playableRadius = Math.min(halfWidth, halfDepth) * 0.65;

    const info: ArenaInfo = {
      floorY: worldFloorY,
      centerX: (worldMinX + worldMaxX) / 2,
      centerZ: (worldMinZ + worldMaxZ) / 2,
      radius: playableRadius,
      halfWidth,
      halfDepth,
      ceilingY: worldCeilY,
    };

    console.log("[Level3Map] New Arena bounding info (world-space):", {
      offsetPos: [offsetX, offsetY, offsetZ],
      scale,
      worldBounds: { worldMinX, worldMaxX, worldMinZ, worldMaxZ, worldFloorY, worldCeilY },
      arenaInfo: info,
    });

    return {
      clonedScene: clone,
      targetScale: [scale, scale, scale] as [number, number, number],
      offsetPos: [offsetX, offsetY, offsetZ] as [number, number, number],
      arenaInfo: info,
    };
  }, [scene]);

  // Notify parent when arena geometry & mapScene are computed
  useEffect(() => {
    if (onArenaReady) {
      onArenaReady(arenaInfo, clonedScene);
    }
  }, [arenaInfo, clonedScene, onArenaReady]);

  return <primitive object={clonedScene} position={offsetPos} scale={targetScale} raycast={() => null} />;
}

useGLTF.preload(LEVEL3_MAP_URL);
