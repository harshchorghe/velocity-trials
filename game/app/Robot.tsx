"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

export default function Robot() {
  const group = useRef<Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;

    group.current.rotation.y += delta * 0.8;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.15;
  });

  return (
    <group ref={group} position={[2, 0, 0]} scale={1.2}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>

      <mesh position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial color="#dbeafe" emissive="#93c5fd" emissiveIntensity={0.25} />
      </mesh>

      <mesh position={[-0.55, 1.2, 0]} rotation={[0, 0, 0.7]}>
        <boxGeometry args={[0.22, 0.9, 0.22]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>

      <mesh position={[0.55, 1.2, 0]} rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.22, 0.9, 0.22]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>

      <mesh position={[-0.3, 0.15, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.24, 1.2, 0.24]} />
        <meshStandardMaterial color="#a5b4fc" />
      </mesh>

      <mesh position={[0.3, 0.15, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.24, 1.2, 0.24]} />
        <meshStandardMaterial color="#a5b4fc" />
      </mesh>

      <mesh position={[-0.3, -1.1, 0]}>
        <boxGeometry args={[0.35, 0.9, 0.35]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>

      <mesh position={[0.3, -1.1, 0]}>
        <boxGeometry args={[0.35, 0.9, 0.35]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
    </group>
  );
}