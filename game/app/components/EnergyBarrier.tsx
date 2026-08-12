"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAP_BOUNDS } from "../utils/gameState";

export function EnergyBarrier() {
  const northWallRef = useRef<THREE.Mesh>(null);
  const southWallRef = useRef<THREE.Mesh>(null);
  const westWallRef = useRef<THREE.Mesh>(null);
  const eastWallRef = useRef<THREE.Mesh>(null);

  // Boundary dimensions
  const minX = MAP_BOUNDS.minX;
  const maxX = MAP_BOUNDS.maxX;
  const minZ = MAP_BOUNDS.minZ;
  const maxZ = MAP_BOUNDS.maxZ;

  const widthX = maxX - minX;
  const widthZ = maxZ - minZ;
  const heightY = 8.0;

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Real-time 60 FPS holographic shimmer animation loop
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const shimmer = Math.sin(time * 2.5) * 0.08 + 0.35;
    const pulseIntensity = Math.sin(time * 3.0) * 0.4 + 1.2;

    const walls = [northWallRef, southWallRef, westWallRef, eastWallRef];
    for (const wallRef of walls) {
      if (wallRef.current && wallRef.current.material) {
        const mat = wallRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = shimmer;
        mat.emissiveIntensity = pulseIntensity;
      }
    }
  });

  return (
    <group name="sci-fi-energy-barrier">
      {/* 1. North Wall (along Z = maxZ) */}
      <mesh ref={northWallRef} position={[centerX, heightY / 2, maxZ]}>
        <planeGeometry args={[widthX, heightY]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#a855f7"
          emissiveIntensity={1.2}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* 2. South Wall (along Z = minZ) */}
      <mesh ref={southWallRef} position={[centerX, heightY / 2, minZ]}>
        <planeGeometry args={[widthX, heightY]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#a855f7"
          emissiveIntensity={1.2}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* 3. West Wall (along X = minX) */}
      <mesh ref={westWallRef} position={[minX, heightY / 2, centerZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[widthZ, heightY]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#a855f7"
          emissiveIntensity={1.2}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* 4. East Wall (along X = maxX) */}
      <mesh ref={eastWallRef} position={[maxX, heightY / 2, centerZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[widthZ, heightY]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#a855f7"
          emissiveIntensity={1.2}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* 5. Glowing Sci-Fi Corner Energy Pillars */}
      {[
        [minX, minZ],
        [maxX, minZ],
        [minX, maxZ],
        [maxX, maxZ],
      ].map(([px, pz], idx) => (
        <group key={idx} position={[px, 0, pz]}>
          <mesh position={[0, heightY / 2, 0]}>
            <cylinderGeometry args={[0.3, 0.4, heightY, 16]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={1.8}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
          <pointLight color="#38bdf8" intensity={3} distance={8} position={[0, 2, 0]} />
        </group>
      ))}
    </group>
  );
}
