export type BulletType = 'LIVE' | 'BLANK';

export interface ChamberState {
  bullets: BulletType[];
  currentIndex: number;
  /** What the player has learned. Drives the drum display — never write dealer recon here. */
  knownBullets: (BulletType | null)[];
  /** What the dealer has learned. Feeds DealerAI and is never shown on screen. */
  dealerKnownBullets: (BulletType | null)[];
}

export type ItemId =
  | 'MAGNIFIER'
  | 'SAW'
  | 'ENERGY_DRINK'
  | 'CIGARETTE'
  | 'HACK_CHIP'
  | 'MIRROR_SHIELD'
  | 'OVERDRIVE'
  | 'MAGNET'
  | 'XRAY'
  | 'OVERDRIVE_2'
  | 'NULLIFIER';

export interface ItemCard {
  id: ItemId;
  name: string;
  icon: string;
  iconUrl?: string;
  description: string;
}

export interface Relic {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  purchased: boolean;
}

export interface MetaUpgrades {
  baseMaxHp: number;       // +1 Base Max HP permanently
  baseArmor: number;       // Base armor shield at start of combat
  baseDamageBonus: number; // Permanent bonus damage to live rounds
}

export interface BossDefinition {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  hp: number;
  armor?: number;
  loreTitle: string;
  loreDesc: string;
  specialAbility: string;
  dialogueSet: string[];
  relicReward?: Relic;
}

export interface LocationDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  bgGradient: string;
  bosses: BossDefinition[];
}

export type ScreenState = 'MAIN_MENU' | 'WORLD_MAP' | 'META_SHOP' | 'BATTLE' | 'SHOP' | 'GAMEOVER' | 'VICTORY';
export type GameTurn = 'PLAYER' | 'DEALER';
export type GamePhase = 'DIALOGUE' | 'BATTLE' | 'SHOP' | 'VICTORY' | 'GAMEOVER';

export interface PlayerStats {
  hp: number;
  maxHp: number;
  hand: ItemCard[];
  chips: number;
  relics: Relic[];
  armor: number;
}

export interface DealerStats {
  name: string;
  avatar: string;
  hp: number;
  maxHp: number;
  armor: number;
  hand: ItemCard[];
  dialogue: string;
}
