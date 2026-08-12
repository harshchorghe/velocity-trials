import { PlayerTransform, MovementState, AnimationState, HealthState } from "./multiplayer";

export type AIBehaviorState = "idle" | "patrol" | "alert" | "combat";

export interface EnemyIdentity {
  id: string;
  name: string;
  type: string;
  color: string;
}

export interface EnemyAIState {
  state: AIBehaviorState;
  targetPlayerId: string | null;
  distanceToTarget?: number;
  attackCooldown: number;
  detectionRange: number;
  lastAttackTime?: number;
  attackRange?: number;
}

export interface EnemyData {
  identity: EnemyIdentity;
  transform: PlayerTransform;
  movement: MovementState;
  ai: EnemyAIState;
  animation: AnimationState;
  health: HealthState;
}

