"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Level3Map, ArenaInfo } from "./Level3Map";
import { Level3Player } from "./Level3Player";
import { AstraBoss } from "./AstraBoss";
import { Level3Camera } from "./Level3Camera";
import { Level3HUD } from "./Level3HUD";
import { gameState } from "../../utils/gameState";

interface Level3SceneProps {
  qualifiedPlayerId?: string;
  onBattleStateChange?: (state: "FIGHTING" | "VICTORY" | "DEFEAT", elapsedTimeSec: number) => void;
  resetSignal?: number;
}

/**
 * Computes spawn positions INSIDE the central black circular arena
 */
function computeSpawns(arena: ArenaInfo) {
  // Spawns placed safely inside the black circular arena radius (~60% of radius)
  const spawnRadiusOffset = arena.radius * 0.55;
  const floorY = arena.floorY;
  const cx = arena.centerX;
  const cz = arena.centerZ;

  return {
    player: {
      position: [cx, floorY, cz + spawnRadiusOffset] as [number, number, number],
      rotationY: Math.PI, // face north toward boss
    },
    boss: {
      position: [cx, floorY, cz - spawnRadiusOffset] as [number, number, number],
      rotationY: 0, // face south toward player
    },
  };
}

// Module-level persistent battle store so component re-renders/remounts never reset player status
const l3BattleStore = {
  status: "FIGHTING" as "FIGHTING" | "VICTORY" | "DEFEAT",
  playerHP: 100,
  playerLives: 1,
  astraHP: 250,
};

export function Level3Scene({ qualifiedPlayerId, onBattleStateChange, resetSignal }: Level3SceneProps) {
  const [arenaInfo, setArenaInfo] = useState<ArenaInfo | null>(null);

  // Authoritative 60 FPS Physics & Position Vector3 Refs (0 React state re-renders)
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 8));
  const playerRotYRef = useRef<number>(Math.PI);

  const astraPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -8));
  const astraRotYRef = useRef<number>(0);

  // Combat State initialized from persistent l3BattleStore
  const [playerHP, setPlayerHP] = useState<number>(() => l3BattleStore.playerHP);
  const [playerLives, setPlayerLives] = useState<number>(() => l3BattleStore.playerLives);
  const [astraHP, setAstraHP] = useState<number>(() => l3BattleStore.astraHP);
  const [battleState, setBattleState] = useState<"FIGHTING" | "VICTORY" | "DEFEAT">(
    () => l3BattleStore.status
  );
  const [elapsedTimeSec, setElapsedTimeSec] = useState<number>(0);

  // Synchronous status ref to prevent frame-race duplicate events
  const battleStateRef = useRef<"FIGHTING" | "VICTORY" | "DEFEAT">(l3BattleStore.status);

  // Visual Effects State
  const [playerIsHit, setPlayerIsHit] = useState(false);
  const [playerIsAttacking, setPlayerIsAttacking] = useState(false);
  const [astraIsHit, setAstraIsHit] = useState(false);
  const [astraIsAttacking, setAstraIsAttacking] = useState(false);

  // Timer interval for Level 3 battle duration
  useEffect(() => {
    if (battleState !== "FIGHTING" || l3BattleStore.status !== "FIGHTING") return;
    const timer = setInterval(() => {
      setElapsedTimeSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [battleState]);

  // Sync state changes with parent component
  const updateBattleState = useCallback(
    (nextState: "FIGHTING" | "VICTORY" | "DEFEAT", currentElapsed: number) => {
      l3BattleStore.status = nextState;
      battleStateRef.current = nextState;
      setBattleState(nextState);
      if (onBattleStateChange) {
        onBattleStateChange(nextState, currentElapsed);
      }
    },
    [onBattleStateChange]
  );

  // Single Authoritative Player Defeat Handler
  const handlePlayerDefeat = useCallback(() => {
    console.log("PLAYER HP REACHED ZERO");
    console.log("PLAYER DEATH HANDLER EXECUTED");
    console.log("PLAYER LIVES: 0");

    l3BattleStore.status = "DEFEAT";
    l3BattleStore.playerHP = 0;
    l3BattleStore.playerLives = 0;
    battleStateRef.current = "DEFEAT";

    setPlayerHP(0);
    setPlayerLives(0);
    updateBattleState("DEFEAT", elapsedTimeSec);
  }, [updateBattleState, elapsedTimeSec]);

  // Reset / Retry Level 3
  const handleResetLevel3 = useCallback(() => {
    console.log("PLAYER HP RESET: 100");
    console.log("PLAYER LIVES: 1");

    l3BattleStore.status = "FIGHTING";
    l3BattleStore.playerHP = 100;
    l3BattleStore.playerLives = 1;
    l3BattleStore.astraHP = 250;
    battleStateRef.current = "FIGHTING";

    setPlayerHP(100);
    setPlayerLives(1);
    setAstraHP(250);
    setElapsedTimeSec(0);
    updateBattleState("FIGHTING", 0);

    if (arenaInfo) {
      const spawns = computeSpawns(arenaInfo);
      playerPosRef.current.set(spawns.player.position[0], spawns.player.position[1], spawns.player.position[2]);
      playerRotYRef.current = spawns.player.rotationY;

      astraPosRef.current.set(spawns.boss.position[0], spawns.boss.position[1], spawns.boss.position[2]);
      astraRotYRef.current = spawns.boss.rotationY;
    }
  }, [arenaInfo, updateBattleState]);

  const prevResetSignalRef = useRef<number>(resetSignal || 0);

  // Sync external reset signals (edge-triggered ONLY when resetSignal increments)
  useEffect(() => {
    if (resetSignal !== undefined && resetSignal > 0 && resetSignal !== prevResetSignalRef.current) {
      prevResetSignalRef.current = resetSignal;
      handleResetLevel3();
    }
  }, [resetSignal, handleResetLevel3]);

  // Determine qualified player info
  const playerId = qualifiedPlayerId || gameState.qualifiedPlayerIds[0] || "player-1";
  const playerData = gameState.players[playerId];
  const playerLabel = playerData?.name || "Player 1";
  const playerColor = playerData?.color || "#38bdf8";

  const handleArenaReady = useCallback((info: ArenaInfo) => {
    console.log("[Level3Scene] Arena ready — Black Circular Arena Spawns:", info);
    setArenaInfo(info);
    const spawns = computeSpawns(info);

    playerPosRef.current.set(spawns.player.position[0], spawns.player.position[1], spawns.player.position[2]);
    playerRotYRef.current = spawns.player.rotationY;

    astraPosRef.current.set(spawns.boss.position[0], spawns.boss.position[1], spawns.boss.position[2]);
    astraRotYRef.current = spawns.boss.rotationY;
  }, []);

  // Player Attack Logic
  const handlePlayerAttack = useCallback(() => {
    if (battleStateRef.current !== "FIGHTING" || battleState !== "FIGHTING" || l3BattleStore.status !== "FIGHTING") return;

    setPlayerIsAttacking(true);
    setTimeout(() => setPlayerIsAttacking(false), 250);

    const dist = playerPosRef.current.distanceTo(astraPosRef.current);

    // Attack Range Check (<= 3.2m)
    if (dist <= 3.2) {
      setAstraIsHit(true);
      setTimeout(() => setAstraIsHit(false), 200);

      setAstraHP((prev) => {
        if (prev <= 0) return 0;
        const next = Math.max(0, prev - 15);
        l3BattleStore.astraHP = next;
        if (next === 0) {
          l3BattleStore.status = "VICTORY";
          battleStateRef.current = "VICTORY";
          updateBattleState("VICTORY", elapsedTimeSec);
        }
        return next;
      });
    }
  }, [battleState, updateBattleState, elapsedTimeSec]);

  // ASTRA Boss Attack Logic
  const handleAstraAttackPlayer = useCallback(() => {
    if (battleStateRef.current !== "FIGHTING" || battleState !== "FIGHTING" || l3BattleStore.status !== "FIGHTING") return;

    setAstraIsAttacking(true);
    setTimeout(() => setAstraIsAttacking(false), 250);

    const dist = playerPosRef.current.distanceTo(astraPosRef.current);

    // Boss Attack Range Check (<= 3.0m)
    if (dist <= 3.0) {
      setPlayerIsHit(true);
      setTimeout(() => setPlayerIsHit(false), 200);

      console.log("PLAYER DAMAGE: 15");
      setPlayerHP((prevHP) => {
        if (prevHP <= 0 || l3BattleStore.status !== "FIGHTING") return 0;
        const nextHP = Math.max(0, prevHP - 15);
        console.log("PLAYER HP:", nextHP);
        l3BattleStore.playerHP = nextHP;

        if (nextHP === 0) {
          handlePlayerDefeat();
        }
        return nextHP;
      });
    }
  }, [battleState, handlePlayerDefeat, updateBattleState, elapsedTimeSec]);

  const isCombatActive =
    battleState === "FIGHTING" &&
    battleStateRef.current === "FIGHTING" &&
    l3BattleStore.status === "FIGHTING" &&
    playerHP > 0 &&
    astraHP > 0;

  return (
    <group name="level-3-boss-arena">
      <Level3Camera
        arenaInfo={arenaInfo}
        playerPosRef={playerPosRef}
        astraPosRef={astraPosRef}
        playerRotYRef={playerRotYRef}
      />
      <Level3Map onArenaReady={handleArenaReady} />

      {/* Render ONLY after arena geometry & boundaries are computed */}
      {arenaInfo && (
        <>
          {/* Qualified Player */}
          <Level3Player
            arenaInfo={arenaInfo}
            posRef={playerPosRef}
            rotationYRef={playerRotYRef}
            label={playerLabel}
            color={playerColor}
            isFighting={isCombatActive}
            onAttack={handlePlayerAttack}
            isHit={playerIsHit}
            isAttacking={playerIsAttacking}
          />

          {/* ASTRA — Final Boss */}
          <AstraBoss
            arenaInfo={arenaInfo}
            posRef={astraPosRef}
            playerPosRef={playerPosRef}
            rotationYRef={astraRotYRef}
            isFighting={isCombatActive}
            onAttackPlayer={handleAstraAttackPlayer}
            isHit={astraIsHit}
            isAttacking={astraIsAttacking}
          />
        </>
      )}

      {/* Level 3 HUD Overlay inside Drei Html Bridge (hidden during Victory and Defeat screens) */}
      {isCombatActive && (
        <Html fullscreen style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "fixed",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              pointerEvents: "auto",
            }}
          >
            <Level3HUD
              qualifiedPlayerId={playerId}
              playerHP={playerHP}
              playerMaxHP={100}
              playerLives={playerLives}
              astraHP={astraHP}
              astraMaxHP={250}
              onAttack={handlePlayerAttack}
            />
          </div>
        </Html>
      )}
    </group>
  );
}
