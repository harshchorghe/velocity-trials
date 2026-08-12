export interface Vector3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface PlayerTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface MovementState {
  isGrounded: boolean;
  speed: number;
  isSprinting: boolean;
  velocity: [number, number, number];
}

export type PlayerAnimationName =
  | 'idle'
  | 'walking'
  | 'run'
  | 'jump'
  | 'attack'
  | 'death '
  | 'A-pose';

export interface AnimationState {
  currentAnimation: PlayerAnimationName;
  isPlaying: boolean;
}

export interface HealthState {
  health: number;
  maxHealth: number;
  lives: number;
}

export interface MultiplayerIdentity {
  id: string;
  name: string;
  color: string;
  isLocalPlayer: boolean;
}

export interface PlayerData {
  identity: MultiplayerIdentity;
  transform: PlayerTransform;
  movement: MovementState;
  animation: AnimationState;
  health: HealthState;
}
