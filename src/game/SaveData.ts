import type { MetaUpgrades } from './Types';

/**
 * 1 — original scale (8 base HP, 1 base damage).
 * 2 — every HP/damage/armor quantity multiplied by 10 so nothing renders with decimals.
 */
export const SAVE_VERSION = 2;

/**
 * The persisted slice of the game. Deliberately excludes anything mid-battle
 * (chamber, hands, HP): a run is resumed at the boss dossier, never mid-duel.
 */
export interface SaveData {
  version: number;
  /** Monotonic write counter — decides which copy is newer when local and cloud disagree. */
  saveCounter: number;
  chips: number;
  metaUpgrades: MetaUpgrades;
  completedBosses: boolean[][];
  unlockedLocationIndex: number;
  currentLocationIndex: number;
  currentBossIndex: number;
  muted: boolean;
  /** Epoch times of granted chip ads, so a reload cannot reset the rolling limit. */
  adChipsGrants: number[];
}
