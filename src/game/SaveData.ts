import type { MetaUpgrades } from './Types';

export const SAVE_VERSION = 1;

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
}
