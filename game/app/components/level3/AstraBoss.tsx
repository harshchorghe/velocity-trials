"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { ArenaInfo } from "./Level3Map";

const ASTRA_BOSS_URL = "/models/boss.glb";

interface AstraBossProps {
  arenaInfo: ArenaInfo;
  posRef: React.MutableRefObject<THREE.Vector3>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  rotationYRef: React.MutableRefObject<number>;
  isFighting?: boolean;
  onAttackPlayer?: () => void;
  isHit?: boolean;
  isAttacking?: boolean;
}

export function AstraBoss({
  arenaInfo,
  posRef,
  playerPosRef,
  rotationYRef,
  isFighting = true,
  onAttackPlayer,
  isHit = false,
  isAttacking = false,
}: AstraBossProps) {
  const { scene, animations } = useGLTF(ASTRA_BOSS_URL);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const { clonedScene, footOffset } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    // Local foot Y relative to group origin when primitive scale is [1.5, 1.5, 1.5]
    const offset = isFinite(box.min.y) ? box.min.y * 1.5 : 0;
    return { clonedScene: clone, footOffset: offset };
  }, [scene]);

  const currentAnimRef = useRef<string>("");
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // Create AnimationMixer ONCE
  useEffect(() => {
    if (clonedScene && animations && animations.length > 0) {
      const mixer = new THREE.AnimationMixer(clonedScene);
      mixerRef.current = mixer;

      return () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(clonedScene);
      };
    }
  }, [clonedScene, animations]);

  const attackCooldownRef = useRef(1.0); // initial delay before boss attacks

  // Synchronize initial ground elevation lock
  useEffect(() => {
    if (posRef.current) {
      posRef.current.y = arenaInfo.floorY - footOffset;
      if (groupRef.current) {
        groupRef.current.position.copy(posRef.current);
        groupRef.current.rotation.y = rotationYRef.current;
      }
    }
  }, [arenaInfo, footOffset, posRef, rotationYRef]);

  // Authoritative 60 FPS Boss Movement & Pursuit Loop
  useFrame((_, delta) => {
    // Clamp delta to max 50ms per frame to prevent lag spike teleports or snaps
    const safeDelta = Math.min(0.05, delta);

    if (mixerRef.current) {
      mixerRef.current.update(safeDelta);
    }

    if (attackCooldownRef.current > 0) {
      attackCooldownRef.current -= safeDelta;
    }

    // Determine ASTRA target animation state
    let targetAnim = "idle";
    if (!isFighting) {
      targetAnim = "death";
    } else if (isAttacking) {
      targetAnim = "fight";
    } else {
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      const bx = posRef.current.x;
      const bz = posRef.current.z;
      const distToPlayer = Math.hypot(px - bx, pz - bz);

      if (distToPlayer > 2.2) {
        targetAnim = "run";
      }
    }

    // Switch animation ONLY when target state changes (0 per-frame restarts)
    if (currentAnimRef.current !== targetAnim && mixerRef.current && animations && animations.length > 0) {
      const nextClip =
        animations.find((clip) => clip.name.toLowerCase() === targetAnim) ||
        animations.find((clip) => clip.name.toLowerCase() === "idle") ||
        animations[0];

      if (nextClip) {
        const nextAction = mixerRef.current.clipAction(nextClip);

        if (targetAnim === "fight" || targetAnim === "death") {
          nextAction.setLoop(THREE.LoopOnce, 1);
          nextAction.clampWhenFinished = true;
        } else {
          nextAction.setLoop(THREE.LoopRepeat, Infinity);
        }

        if (currentActionRef.current && currentActionRef.current !== nextAction) {
          currentActionRef.current.fadeOut(0.15);
        }

        nextAction.reset().fadeIn(0.15).play();
        currentActionRef.current = nextAction;
        currentAnimRef.current = targetAnim;
      }
    }

    if (groupRef.current && isFighting) {
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      const bx = posRef.current.x;
      const bz = posRef.current.z;

      const dx = px - bx;
      const dz = pz - bz;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      if (distToPlayer > 0.01) {
        // Smoothly rotate boss toward player
        const targetRotY = Math.atan2(dx, dz);
        let diff = targetRotY - rotationYRef.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        rotationYRef.current += diff * Math.min(1.0, safeDelta * 6.0);

        // Move toward player ONLY if outside preferred melee distance (2.2m)
        if (distToPlayer > 2.2) {
          const speed = 4.2; // Moderate boss pursuit speed
          let newX = bx + (dx / distToPlayer) * speed * safeDelta;
          let newZ = bz + (dz / distToPlayer) * speed * safeDelta;

          // SINGLE AUTHORITATIVE BLACK CIRCULAR ARENA BOUNDARY CLAMP
          const cx = arenaInfo.centerX;
          const cz = arenaInfo.centerZ;
          const cDx = newX - cx;
          const cDz = newZ - cz;
          const cDist = Math.sqrt(cDx * cDx + cDz * cDz);
          const maxRadius = Math.max(2.0, arenaInfo.radius - 0.8);

          if (cDist > maxRadius) {
            newX = cx + (cDx / cDist) * maxRadius;
            newZ = cz + (cDz / cDist) * maxRadius;
          }

          const groundY = arenaInfo.floorY - footOffset;
          posRef.current.set(newX, groundY, newZ);
        } else {
          // Lock standing Y elevation when stopped in melee range
          posRef.current.y = arenaInfo.floorY - footOffset;
        }

        // Boss Attack Trigger
        if (distToPlayer <= 3.0 && attackCooldownRef.current <= 0) {
          attackCooldownRef.current = 1.35; // 1.35s attack cooldown
          if (onAttackPlayer) {
            onAttackPlayer();
          }
        }
      }

      // Synchronize Three.js group transform directly
      groupRef.current.position.copy(posRef.current);
      groupRef.current.rotation.y = rotationYRef.current;
    }
  });

  return (
    <group ref={groupRef} position={posRef.current} rotation={[0, rotationYRef.current, 0]} raycast={() => null}>
      <primitive object={clonedScene} scale={[1.5, 1.5, 1.5]} raycast={() => null} />

      {/* Red Hit Flash Ring */}
      {isHit && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.8, 2.2, 32]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Boss Attack Energy Wave */}
      {isAttacking && (
        <mesh position={[0, 1.5, 1.2]} rotation={[0.4, 0, 0]} raycast={() => null}>
          <ringGeometry args={[1.2, 2.5, 32, 1, 0, Math.PI]} />
          <meshBasicMaterial color="#dc2626" side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>
      )}

      {/* Astra Boss Badge (hidden when isFighting is false) */}
      {isFighting && (
        <Html
          position={[0, 4.2, 0]}
          center
          distanceFactor={22}
          style={{ pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap" }}
        >
          <div
            style={{
              background: isHit ? "rgba(220, 38, 38, 0.95)" : "rgba(15, 23, 42, 0.9)",
              backdropFilter: "blur(8px)",
              border: "1.5px solid #ef4444",
              borderRadius: "6px",
              padding: "4px 10px",
              color: "#ef4444",
              fontFamily: "system-ui, sans-serif",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "1px",
              boxShadow: isHit
                ? "0 0 25px rgba(239, 68, 68, 0.9)"
                : "0 0 15px rgba(239, 68, 68, 0.6)",
              transition: "all 0.15s ease",
            }}
          >
            👑 ASTRA — FINAL BOSS
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(ASTRA_BOSS_URL);
