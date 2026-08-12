import * as THREE from "three";

// Playable map boundary limits based on city layout
export const MAP_BOUNDS = {
  minX: -36.0,
  maxX: 20.0,
  minZ: -28.0,
  maxZ: 30.0,
};

export const ATTACK_RANGE = 2.0;
export const ATTACK_COOLDOWN = 1.0; // 1 second
export const ATTACK_DAMAGE = 6.5;

export interface EntityTransform {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export interface GestureCommandState {
  rawGesture: string;
  activeGesture: string;
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  stop: boolean;
  jumpPulse: boolean;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export interface StoneData {
  id: string;
  playerId: string;
  name: string;
  pos: [number, number, number];
  color: string;
  collected: boolean;
  isNearby?: boolean;
}

// Shared real-time store for 60 FPS zero-lag physics & AI positioning
class GameStore {
  qualifiedPlayerIds: string[] = [];
  eliminatedPlayerId: string | null = null;
  completionVideoUrl: string = "/videos/level2-complete.mp4";
  qualificationLimit: number = 1;

  gestureState: GestureCommandState = {
    rawGesture: "NONE",
    activeGesture: "NONE",
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    stop: false,
    jumpPulse: false,
  };

  setGestureState(state: Partial<GestureCommandState>) {
    this.gestureState = { ...this.gestureState, ...state };
  }

  triggerJumpPulse() {
    this.gestureState.jumpPulse = true;
  }

  clearJumpPulse() {
    this.gestureState.jumpPulse = false;
  }

  players: Record<string, {
    id: string;
    name: string;
    color: string;
    isLocalPlayer: boolean;
    pos: [number, number, number];
    rotationY: number;
    health: number;
    maxHealth: number;
    lives: number;
    activeAnim: string;
    stonesCollected: number;
    status: "PLAYING" | "QUALIFIED" | "ELIMINATED";
    elapsedTimeSec: number;
    completionTimeFormatted?: string;
    qualificationRank?: number;
  }> = {
    "player-1": {
      id: "player-1",
      name: "Player 1",
      color: "#38bdf8",
      isLocalPlayer: true,
      pos: [-2.63, 0, -2.06],
      rotationY: 0,
      health: 100,
      maxHealth: 100,
      lives: 3,
      activeAnim: "idle",
      stonesCollected: 0,
      status: "PLAYING",
      elapsedTimeSec: 0,
    },
  };

  stones: Record<string, StoneData> = {
    // Player 1 Assigned Stones (Blue) — Distributed in Far Northeast, Far Southwest, and Far East
    "P1_STONE_1": {
      id: "P1_STONE_1",
      playerId: "player-1",
      name: "P1 Gem #1",
      pos: [14.35, 0, 26.58], // Far Northeast Plaza
      color: "#38bdf8",
      collected: false,
    },
    "P1_STONE_2": {
      id: "P1_STONE_2",
      playerId: "player-1",
      name: "P1 Gem #2",
      pos: [-33.72, 0, -20.47], // Far Southwest Corner
      color: "#38bdf8",
      collected: false,
    },
    "P1_STONE_3": {
      id: "P1_STONE_3",
      playerId: "player-1",
      name: "P1 Gem #3",
      pos: [17.10, 0, -2.06], // Far East Dead End
      color: "#38bdf8",
      collected: false,
    },
  };

  /**
   * Updates real-time Level 2 timers for playing players
   */
  updatePlayerTimers(delta: number) {
    for (const p of Object.values(this.players)) {
      if (p.status === "PLAYING") {
        p.elapsedTimeSec += delta;
      }
    }
  }

  /**
   * Atomic stone collection logic enforcing strict per-player ownership
   * and authoritative 2-player qualification competition rule.
   */
  collectStone(stoneId: string, playerId: string): boolean {
    const stone = this.stones[stoneId];
    const player = this.players[playerId];
    if (!stone || !player || stone.collected || stone.playerId !== playerId) {
      return false;
    }
    stone.collected = true;
    player.stonesCollected = Math.min(3, (player.stonesCollected || 0) + 1);

    // When 3 assigned stones are collected, evaluate qualification
    if (player.stonesCollected === 3 && player.status === "PLAYING") {
      if (this.qualifiedPlayerIds.length < this.qualificationLimit) {
        // Player qualifies! Add to qualification order array
        this.qualifiedPlayerIds.push(playerId);
        player.qualificationRank = this.qualifiedPlayerIds.length;
        player.status = "QUALIFIED";
        player.completionTimeFormatted = formatTime(player.elapsedTimeSec);

        console.log(
          `[QUALIFIED #${player.qualificationRank}] ${player.name} (${playerId}) qualified at ${player.completionTimeFormatted}!`
        );

        // When the 2nd player qualifies, IMMEDIATELY eliminate the 3rd remaining player
        if (this.qualifiedPlayerIds.length === this.qualificationLimit) {
          const remainingPlayer = Object.values(this.players).find(
            (p) => p.status === "PLAYING"
          );
          if (remainingPlayer) {
            remainingPlayer.status = "ELIMINATED";
            remainingPlayer.health = 0;
            remainingPlayer.lives = 0;
            remainingPlayer.activeAnim = "death";
            this.eliminatedPlayerId = remainingPlayer.id;
            console.log(
              `[3RD PLAYER ELIMINATED] ${remainingPlayer.name} (${remainingPlayer.id}) eliminated! 2 spots filled.`
            );
          }
        }
      } else {
        // Qualification spots filled — player is ELIMINATED
        player.status = "ELIMINATED";
        player.health = 0;
        player.lives = 0;
        player.activeAnim = "death";
        console.log(`[ELIMINATED] ${player.name} (${playerId}) finished after 2 spots were already taken.`);
      }
    }
    return true;
  }

  enemies: Record<string, {
    id: string;
    name: string;
    color: string;
    pos: [number, number, number];
    rotationY: number;
    health: number;
    maxHealth: number;
    state: "idle" | "alert" | "combat";
    targetId: string | null;
    distToTarget?: number;
    activeAnim: string;
    lastAttackTime: number;
  }> = {};

  detectionRange: number = 25.0;
  cameraYaw: number = 0;
  buildingBoxes: THREE.Box3[] = [];
  cityScene: THREE.Object3D | null = null;
  buildingMeshes: THREE.Mesh[] = [];
  roadMeshes: THREE.Mesh[] = [];
  private groundRaycaster = new THREE.Raycaster();
  private groundOrigin = new THREE.Vector3();
  private groundDir = new THREE.Vector3(0, -1, 0);

  setCityScene(scene: THREE.Object3D) {
    this.cityScene = scene;
    this.buildingBoxes = [];
    this.buildingMeshes = [];
    this.roadMeshes = [];

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = (mesh.name || "").toLowerCase();
        // Categorize road/suelo/piso vs building/obstacle meshes
        if (name.includes("calle") || name.includes("road") || name.includes("suelo") || name.includes("piso")) {
          this.roadMeshes.push(mesh);
        } else {
          this.buildingMeshes.push(mesh);
          mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox) {
            const box = mesh.geometry.boundingBox.clone();
            box.applyMatrix4(mesh.matrixWorld);
            // Ensure box height overlaps character height
            if (box.max.y > 0 && box.min.y < 5) {
              this.buildingBoxes.push(box);
            }
          }
        }
      }
    });

    // Snap Y elevations for all 9 stones to city ground
    for (const stone of Object.values(this.stones)) {
      const gY = this.getGroundHeight(stone.pos[0], stone.pos[2], stone.pos[1]);
      stone.pos[1] = gY;
    }
  }

  private groundCacheMap = new Map<string, number>();

  /**
   * Snaps position to exact city ground/road surface Y level (optimized with spatial caching)
   */
  getGroundHeight(x: number, z: number, defaultY = 0): number {
    if (!this.cityScene) return defaultY;
    const cacheKey = `${Math.round(x * 5)}_${Math.round(z * 5)}`;
    if (this.groundCacheMap.has(cacheKey)) {
      return this.groundCacheMap.get(cacheKey)!;
    }

    this.groundOrigin.set(x, 50, z);
    this.groundRaycaster.set(this.groundOrigin, this.groundDir);
    this.groundRaycaster.far = 100;

    const targetMeshes = this.roadMeshes.length > 0 ? this.roadMeshes : [this.cityScene];
    const hits = this.groundRaycaster.intersectObjects(targetMeshes, true);
    const resultY = hits.length > 0 ? hits[0].point.y : defaultY;
    this.groundCacheMap.set(cacheKey, resultY);
    return resultY;
  }

  /**
   * Integrates cleanly with player health/lives system
   */
  damagePlayer(playerId: string, damageAmount: number): boolean {
    const player = this.players[playerId];
    if (!player || player.lives <= 0 || player.status !== "PLAYING") return false;

    player.health = Math.max(0, player.health - damageAmount);
    if (player.health <= 0) {
      player.lives -= 1;
      if (player.lives > 0) {
        // Respawn / restore HP when lives remain
        player.health = player.maxHealth;
      } else {
        // Player defeated & ELIMINATED
        player.health = 0;
        player.lives = 0;
        player.status = "ELIMINATED";
        player.activeAnim = "death";
      }
    }
    return true;
  }

  /**
   * Resets player health, lives, status, and stones for clean Level 2 restart/recovery
   */
  resetPlayer(playerId?: string) {
    // If specific playerId provided, reset that player; otherwise reset all
    const targetIds = playerId ? [playerId] : Object.keys(this.players);

    for (const pid of targetIds) {
      const player = this.players[pid];
      if (!player) continue;
      player.health = player.maxHealth;
      player.lives = 3;
      player.stonesCollected = 0;
      player.status = "PLAYING";
      player.elapsedTimeSec = 0;
      player.completionTimeFormatted = undefined;
      player.qualificationRank = undefined;
      player.activeAnim = "idle";

      // Uncollect assigned stones for this player
      for (const stone of Object.values(this.stones)) {
        if (stone.playerId === pid) {
          stone.collected = false;
          stone.isNearby = false;
        }
      }

      // Remove from qualification list if present
      this.qualifiedPlayerIds = this.qualifiedPlayerIds.filter((id) => id !== pid);
      if (this.eliminatedPlayerId === pid) {
        this.eliminatedPlayerId = null;
      }
    }
  }

  /**
   * Helper getters preparing game state for Level 3 transition
   */
  getQualifiedLevel3Players() {
    return this.qualifiedPlayerIds.map((id) => this.players[id]).filter(Boolean);
  }

  getEliminatedLevel3Player() {
    return this.eliminatedPlayerId ? this.players[this.eliminatedPlayerId] : null;
  }

  /**
   * Fast 3D building collision, map boundary check & ground height snapping
   */
  validatePosition(currentPos: [number, number, number], targetX: number, targetZ: number, radius = 0.5): [number, number, number] {
    // 1. Clamp inside map boundaries with safety margin so entities NEVER walk out of the map
    const safeMargin = Math.max(0.6, radius);
    const clampedX = Math.max(MAP_BOUNDS.minX + safeMargin, Math.min(MAP_BOUNDS.maxX - safeMargin, targetX));
    const clampedZ = Math.max(MAP_BOUNDS.minZ + safeMargin, Math.min(MAP_BOUNDS.maxZ - safeMargin, targetZ));
    const groundY = this.getGroundHeight(clampedX, clampedZ, currentPos[1]);

    if (this.buildingBoxes.length === 0) {
      return [clampedX, groundY, clampedZ];
    }

    // 2. Check collision against building bounding boxes
    const entityBox = new THREE.Box3(
      new THREE.Vector3(clampedX - radius, currentPos[1] + 0.1, clampedZ - radius),
      new THREE.Vector3(clampedX + radius, currentPos[1] + 2.0, clampedZ + radius)
    );

    for (const bBox of this.buildingBoxes) {
      if (entityBox.intersectsBox(bBox)) {
        // Collides with building! Test sliding along X or Z axis
        const testXBox = new THREE.Box3(
          new THREE.Vector3(clampedX - radius, currentPos[1] + 0.1, currentPos[2] - radius),
          new THREE.Vector3(clampedX + radius, currentPos[1] + 2.0, currentPos[2] + radius)
        );
        const testZBox = new THREE.Box3(
          new THREE.Vector3(currentPos[0] - radius, currentPos[1] + 0.1, clampedZ - radius),
          new THREE.Vector3(currentPos[0] + radius, currentPos[1] + 2.0, clampedZ + radius)
        );

        const xCollides = this.buildingBoxes.some(b => testXBox.intersectsBox(b));
        const zCollides = this.buildingBoxes.some(b => testZBox.intersectsBox(b));

        if (!xCollides) {
          const yVal = this.getGroundHeight(clampedX, currentPos[2], currentPos[1]);
          return [clampedX, yVal, currentPos[2]];
        } else if (!zCollides) {
          const yVal = this.getGroundHeight(currentPos[0], clampedZ, currentPos[1]);
          return [currentPos[0], yVal, clampedZ];
        } else {
          // Blocked on both axes -> stay at current position
          return currentPos;
        }
      }
    }

    return [clampedX, groundY, clampedZ];
  }
}

export const gameState = new GameStore();

