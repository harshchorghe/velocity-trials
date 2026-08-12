import * as THREE from "three";

export interface WaypointNode {
  id: string;
  pos: [number, number, number];
  neighbors: string[];
}

// Street network graph nodes extracted from ciudadortogonal26.glb road locations
export const STREET_WAYPOINTS: Record<string, WaypointNode> = {
  w_center: { id: "w_center", pos: [-2.63, 0, -2.06], neighbors: ["w_east", "w_west", "w_north", "w_south"] },
  w_east: { id: "w_east", pos: [11.11, 0, -2.06], neighbors: ["w_center", "w_far_east", "w_north_east", "w_south_east"] },
  w_far_east: { id: "w_far_east", pos: [17.10, 0, -2.06], neighbors: ["w_east"] },
  w_west: { id: "w_west", pos: [-15.53, 0, -2.06], neighbors: ["w_center", "w_far_west", "w_north_west", "w_south_west"] },
  w_far_west: { id: "w_far_west", pos: [-33.69, 0, -2.06], neighbors: ["w_west", "w_far_sw"] },
  
  w_north: { id: "w_north", pos: [-2.66, 0, 13.22], neighbors: ["w_center", "w_north_east", "w_north_west"] },
  w_north_east: { id: "w_north_east", pos: [17.06, 0, 13.22], neighbors: ["w_east", "w_north", "w_far_ne"] },
  w_far_ne: { id: "w_far_ne", pos: [14.35, 0, 26.58], neighbors: ["w_north_east"] },
  w_north_west: { id: "w_north_west", pos: [-15.55, 0, 13.22], neighbors: ["w_west", "w_north", "w_far_nw"] },
  w_far_nw: { id: "w_far_nw", pos: [-33.71, 0, 13.22], neighbors: ["w_north_west"] },

  w_south: { id: "w_south", pos: [-2.63, 0, -20.47], neighbors: ["w_center", "w_south_east", "w_south_west"] },
  w_south_east: { id: "w_south_east", pos: [17.06, 0, -20.47], neighbors: ["w_east", "w_south", "w_far_se"] },
  w_far_se: { id: "w_far_se", pos: [14.35, 0, -25.52], neighbors: ["w_south_east"] },
  w_south_west: { id: "w_south_west", pos: [-15.53, 0, -20.47], neighbors: ["w_west", "w_south", "w_far_sw"] },
  w_far_sw: { id: "w_far_sw", pos: [-33.72, 0, -20.47], neighbors: ["w_far_west", "w_south_west"] },
};

export interface ExtractedCityMeshes {
  roadMeshes: THREE.Mesh[];
  buildingMeshes: THREE.Mesh[];
}

/**
 * Extracts and categorizes city meshes once on load
 */
export function extractCityMeshes(cityScene: THREE.Object3D): ExtractedCityMeshes {
  const roadMeshes: THREE.Mesh[] = [];
  const buildingMeshes: THREE.Mesh[] = [];

  cityScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const nameLower = (mesh.name || "").toLowerCase();
      // Check if mesh belongs to road/street layer
      if (nameLower.includes("calle") || nameLower.includes("road") || nameLower.includes("suelo") || nameLower.includes("piso")) {
        roadMeshes.push(mesh);
      } else {
        buildingMeshes.push(mesh);
      }
    }
  });

  return { roadMeshes, buildingMeshes };
}

// Reusable Raycaster instances for performance
const losRaycaster = new THREE.Raycaster();
const collisionRaycaster = new THREE.Raycaster();

/**
 * Tests if there is an unblocked line of sight between two positions
 */
export function hasLineOfSight(
  fromPos: [number, number, number],
  toPos: [number, number, number],
  buildingMeshes: THREE.Mesh[]
): boolean {
  if (buildingMeshes.length === 0) return true;

  const origin = new THREE.Vector3(fromPos[0], fromPos[1] + 0.8, fromPos[2]);
  const target = new THREE.Vector3(toPos[0], toPos[1] + 0.8, toPos[2]);
  const dir = new THREE.Vector3().subVectors(target, origin);
  const maxDist = dir.length();

  if (maxDist < 0.1) return true;

  dir.normalize();
  losRaycaster.set(origin, dir);
  losRaycaster.far = maxDist - 0.2;

  const hits = losRaycaster.intersectObjects(buildingMeshes, true);
  return hits.length === 0;
}

/**
 * Performs environment building collision check with wall sliding
 */
export function checkBuildingCollision(
  currentPos: [number, number, number],
  targetMove: [number, number, number],
  buildingMeshes: THREE.Mesh[],
  radius = 0.5
): [number, number, number] {
  if (buildingMeshes.length === 0) return targetMove;

  const origin = new THREE.Vector3(currentPos[0], currentPos[1] + 0.8, currentPos[2]);
  const moveVec = new THREE.Vector3(
    targetMove[0] - currentPos[0],
    0,
    targetMove[2] - currentPos[2]
  );
  const moveDist = moveVec.length();

  if (moveDist < 0.0001) return currentPos;

  const moveDir = moveVec.clone().normalize();

  // Test 8 radial collision probes around entity waist
  const angles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, Math.PI];

  for (const angle of angles) {
    const probeDir = moveDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    collisionRaycaster.set(origin, probeDir);
    collisionRaycaster.far = radius + (angle === 0 ? moveDist : 0.1);

    const hits = collisionRaycaster.intersectObjects(buildingMeshes, true);
    if (hits.length > 0) {
      const hit = hits[0];
      if (hit.distance < radius + moveDist) {
        // Collision detected! Calculate wall normal
        const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
        if (hit.object) {
          normal.transformDirection(hit.object.matrixWorld);
        }
        normal.y = 0;
        normal.normalize();

        // Project movement vector onto wall tangent plane (wall sliding)
        const dot = moveVec.dot(normal);
        if (dot < 0) {
          moveVec.sub(normal.clone().multiplyScalar(dot));
        }
      }
    }
  }

  return [
    currentPos[0] + moveVec.x,
    currentPos[1],
    currentPos[2] + moveVec.z,
  ];
}

/**
 * Finds shortest path on street waypoint graph using BFS/A*
 */
function findWaypointPath(startId: string, endId: string): string[] {
  if (startId === endId) return [endId];

  const queue: string[][] = [[startId]];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];

    if (node === endId) return path;

    const neighbors = STREET_WAYPOINTS[node]?.neighbors || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push([...path, n]);
      }
    }
  }

  return [endId];
}

/**
 * Computes optimal navigation direction for enemy toward target player
 */
export function getNavigationDirection(
  enemyPos: [number, number, number],
  targetPos: [number, number, number],
  buildingMeshes: THREE.Mesh[]
): { dirX: number; dirZ: number; waypoints?: [number, number, number][] } {
  // 1. If direct line of sight is clear, move directly to target
  if (hasLineOfSight(enemyPos, targetPos, buildingMeshes)) {
    const dx = targetPos[0] - enemyPos[0];
    const dz = targetPos[2] - enemyPos[2];
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return { dirX: 0, dirZ: 0 };
    return { dirX: dx / dist, dirZ: dz / dist };
  }

  // 2. Otherwise, navigate via nearest street waypoints around buildings
  let startW = "w_center";
  let minStartDist = Infinity;
  let endW = "w_center";
  let minEndDist = Infinity;

  for (const [id, wp] of Object.entries(STREET_WAYPOINTS)) {
    const distS = Math.hypot(wp.pos[0] - enemyPos[0], wp.pos[2] - enemyPos[2]);
    if (distS < minStartDist) {
      minStartDist = distS;
      startW = id;
    }

    const distE = Math.hypot(wp.pos[0] - targetPos[0], wp.pos[2] - targetPos[2]);
    if (distE < minEndDist) {
      minEndDist = distE;
      endW = id;
    }
  }

  const pathIds = findWaypointPath(startW, endW);
  const nextNodeId = pathIds.length > 1 ? pathIds[1] : pathIds[0];
  const nextTargetPos = STREET_WAYPOINTS[nextNodeId]?.pos || targetPos;

  const dx = nextTargetPos[0] - enemyPos[0];
  const dz = nextTargetPos[2] - enemyPos[2];
  const dist = Math.hypot(dx, dz);

  if (dist < 0.001) return { dirX: 0, dirZ: 0 };
  return { dirX: dx / dist, dirZ: dz / dist };
}
