"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { ArenaInfo } from "./Level3Map";

const LEVEL3_PLAYER_URL = "/models/L3-player.glb";

interface Level3PlayerProps {
  arenaInfo: ArenaInfo;
  posRef: React.MutableRefObject<THREE.Vector3>;
  rotationYRef: React.MutableRefObject<number>;
  label?: string;
  color?: string;
  isFighting?: boolean;
  onAttack?: () => void;
  isHit?: boolean;
  isAttacking?: boolean;
}

export function Level3Player({
  arenaInfo,
  posRef,
  rotationYRef,
  label = "",
  color = "#38bdf8",
  isFighting = true,
  onAttack,
  isHit = false,
  isAttacking = false,
}: Level3PlayerProps) {
  const { scene, animations } = useGLTF(LEVEL3_PLAYER_URL);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const { clonedScene, footOffset, visualScale } = useMemo(() => {
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
    // Visual model scale (~22% larger than 0.95)
    const PLAYER_VISUAL_SCALE = 1.18;
    // Local foot Y relative to group origin when primitive scale is [1.18, 1.18, 1.18]
    const offset = isFinite(box.min.y) ? box.min.y * PLAYER_VISUAL_SCALE : 0;
    return { clonedScene: clone, footOffset: offset, visualScale: PLAYER_VISUAL_SCALE };
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

  // Key tracking state stored in ref (zero re-render overhead)
  const keysRef = useRef<{ w: boolean; a: boolean; s: boolean; d: boolean }>({
    w: false,
    a: false,
    s: false,
    d: false,
  });

  const attackCooldownRef = useRef(0);

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

  // Keyboard Event Registration (Clean ONCE on mount + Window Blur Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFighting) return;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") keysRef.current.w = true;
      if (k === "s" || k === "arrowdown") keysRef.current.s = true;
      if (k === "a" || k === "arrowleft") keysRef.current.a = true;
      if (k === "d" || k === "arrowright") keysRef.current.d = true;

      // ATTACK TRIGGERS: ENTER KEY & SPACEBAR
      if (e.code === "Enter" || e.key === "Enter" || e.code === "Space" || k === " ") {
        e.preventDefault();
        if (attackCooldownRef.current <= 0 && onAttack) {
          attackCooldownRef.current = 0.55; // 0.55s attack cooldown
          onAttack();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") keysRef.current.w = false;
      if (k === "s" || k === "arrowdown") keysRef.current.s = false;
      if (k === "a" || k === "arrowleft") keysRef.current.a = false;
      if (k === "d" || k === "arrowright") keysRef.current.d = false;
    };

    const handleBlur = () => {
      keysRef.current = { w: false, a: false, s: false, d: false };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isFighting, onAttack]);

  // Authoritative 60 FPS Frame Delta Movement Loop
  useFrame((_, delta) => {
    // Clamp delta to max 50ms per frame to prevent lag spike teleports or snaps
    const safeDelta = Math.min(0.05, delta);

    if (mixerRef.current) {
      mixerRef.current.update(safeDelta);
    }

    if (attackCooldownRef.current > 0) {
      attackCooldownRef.current -= safeDelta;
    }

    // Determine target animation state
    let targetAnim = "idle";
    if (!isFighting) {
      targetAnim = "death";
    } else if (isAttacking) {
      targetAnim = "attack1";
    } else {
      const { w, a, s, d } = keysRef.current;
      if (w || a || s || d) {
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

        if (targetAnim === "attack1" || targetAnim === "death") {
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
      const { w, a, s, d } = keysRef.current;
      let dirX = 0;
      let dirZ = 0;

      if (w) dirZ -= 1;
      if (s) dirZ += 1;
      if (a) dirX -= 1;
      if (d) dirX += 1;

      if (dirX !== 0 || dirZ !== 0) {
        // Normalize diagonal movement vector so diagonal speed equals cardinal speed
        const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
        dirX /= len;
        dirZ /= len;

        const speed = 7.5; // Smooth player movement speed
        let newX = posRef.current.x + dirX * speed * safeDelta;
        let newZ = posRef.current.z + dirZ * speed * safeDelta;

        // SINGLE AUTHORITATIVE BLACK CIRCULAR ARENA BOUNDARY CLAMP
        const cx = arenaInfo.centerX;
        const cz = arenaInfo.centerZ;
        const dx = newX - cx;
        const dz = newZ - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const maxRadius = Math.max(2.0, arenaInfo.radius - 0.6);

        if (dist > maxRadius) {
          newX = cx + (dx / dist) * maxRadius;
          newZ = cz + (dz / dist) * maxRadius;
        }

        // Smooth angular rotation lerp toward target movement direction
        const targetRotY = Math.atan2(dirX, dirZ);
        let diff = targetRotY - rotationYRef.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        rotationYRef.current += diff * Math.min(1.0, safeDelta * 12.0);

        // Lock feet cleanly on top surface of circular floor
        const groundY = arenaInfo.floorY - footOffset;

        // Mutate Vector3 ref directly (0 React state re-renders)
        posRef.current.set(newX, groundY, newZ);
      } else {
        // Lock standing Y elevation when idle (fixed Y standing height)
        posRef.current.y = arenaInfo.floorY - footOffset;
      }

      // Synchronize Three.js group transform directly
      groupRef.current.position.copy(posRef.current);
      groupRef.current.rotation.y = rotationYRef.current;
    }
  });

  return (
    <group ref={groupRef} position={posRef.current} rotation={[0, rotationYRef.current, 0]} raycast={() => null}>
      <primitive object={clonedScene} scale={[visualScale, visualScale, visualScale]} raycast={() => null} />

      {/* Hit Flash Ring */}
      {isHit && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.5, 1.2, 32]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} transparent opacity={0.7} />
        </mesh>
      )}

      {/* Attack Slash Effect */}
      {isAttacking && (
        <mesh position={[0, 1.2, 0.8]} rotation={[0.4, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.8, 1.6, 32, 1, 0, Math.PI]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Level 3 Player Badge (hidden when isFighting is false) */}
      {isFighting && (
        <Html
          position={[0, 3.4, 0]}
          center
          distanceFactor={18}
          style={{ pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap" }}
        >
          <div
            style={{
              background: isHit ? "rgba(239, 68, 68, 0.95)" : "rgba(15, 23, 42, 0.88)",
              backdropFilter: "blur(6px)",
              border: `1.5px solid ${isHit ? "#ef4444" : color}`,
              borderRadius: "6px",
              padding: "3px 8px",
              color: "#ffffff",
              fontFamily: "system-ui, sans-serif",
              fontSize: "10px",
              fontWeight: 800,
              boxShadow: `0 0 10px ${color}80`,
              transition: "all 0.15s ease",
            }}
          >
            ⚡ {label || "PLAYER"}
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(LEVEL3_PLAYER_URL);
