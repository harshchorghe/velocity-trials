/** SQLite has no native enum support, so these string unions are the contract. */

export const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ELIMINATED: 'ELIMINATED',
} as const;
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const POWERS = ['SPRINT', 'JUMP', 'FLIGHT'] as const;
export type Power = (typeof POWERS)[number];

export const WEAPONS = ['sword', 'blaster', 'spear'] as const;
export type Weapon = (typeof WEAPONS)[number];

/** Damage is decided by the server; the client only names the action. */
export const WEAPON_STATS: Record<Weapon, { attack: number; ultimate: number }> = {
  sword: { attack: 20, ultimate: 38 },
  blaster: { attack: 18, ultimate: 40 },
  spear: { attack: 19, ultimate: 36 },
};

export const GAME_CONFIG = {
  TOTAL_CLUES: 3,
  SECRET_CODE_LENGTH: 4,
  TOTAL_CRYSTALS: 3,
  STARTING_LIVES: 3,
  BOSS_MAX_HP: 100,
  PLAYER_MAX_HP: 100,

  /** How many players clear Level 1 into Level 2, and Level 2 into the final. */
  LEVEL1_QUALIFY_LIMIT: 10,
  LEVEL2_QUALIFY_LIMIT: 2,

  /** Server-side floor between boss actions, to bound damage-per-second. */
  BOSS_ACTION_COOLDOWN_MS: 350,
  DODGE_HEAL: 5,
  BOSS_COUNTER_DAMAGE: 8,
} as const;

export const SETTING_KEYS = {
  FINAL_SECRET_CODE: 'FINAL_SECRET_CODE',
} as const;
