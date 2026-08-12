"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EnemyRobot } from "./EnemyRobot";
import { gameState, ATTACK_RANGE, ATTACK_COOLDOWN, ATTACK_DAMAGE } from "../utils/gameState";

interface EnemyManagerProps {
  onEnemiesStateChange?: () => void;
}

export function EnemyManager(_props: EnemyManagerProps) {
  return null;
}
