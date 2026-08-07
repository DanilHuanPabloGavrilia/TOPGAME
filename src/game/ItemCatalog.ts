import type { ItemCard, ItemId, Relic } from './Types';
import { t } from '../i18n';

// Imported rather than referenced by absolute path so Vite rewrites them against `base`.
import cigaretteIcon from '../assets/images/items/cigarette.webp';
import energyIcon from '../assets/images/items/energy.webp';
import hackchipIcon from '../assets/images/items/hackchip.webp';
import magnetIcon from '../assets/images/items/magnet.webp';
import magnifierIcon from '../assets/images/items/magnifier.webp';
import nullifierIcon from '../assets/images/items/nullifier.webp';
import overdriveIcon from '../assets/images/items/overdrive.webp';
import overdrive2Icon from '../assets/images/items/overdrive2.webp';
import sawIcon from '../assets/images/items/saw.webp';
import shieldIcon from '../assets/images/items/shield.webp';
import xrayIcon from '../assets/images/items/xray.webp';

/**
 * Damage multipliers, strongest first. This table is the only place the numbers live:
 * the effect, the on-screen dialogue and the card text below all read from it, so a card
 * that promises х3 can never resolve as anything else.
 *
 * Only one can stand at a time — `GameState.useItem` refuses a second booster rather than
 * overwriting the first, and nothing here ever stacks.
 */
export const MULTIPLIER_CARDS: { id: ItemId; value: number }[] = [
  { id: 'OVERDRIVE', value: 3 },
  { id: 'OVERDRIVE_2', value: 2.5 },
  { id: 'SAW', value: 2 }
];

/** The multiplier this card applies, or null when the card is not a booster. */
export function multiplierValue(id: ItemId): number | null {
  return MULTIPLIER_CARDS.find(m => m.id === id)?.value ?? null;
}

export function isMultiplierCard(id: ItemId): boolean {
  return multiplierValue(id) !== null;
}

/**
 * Turns a catalog entry into a display-ready card: `name` and `description` hold i18n keys,
 * and this is where they become text.
 *
 * Resolution happens here rather than in the catalog literal because the catalog is built at
 * import time, long before the platform has told us which language to speak. Every hand is
 * dealt through this function, so by the time a card reaches the table it is already in the
 * player's language.
 *
 * Booster text is kept short on purpose in every locale: `.card-desc` clamps to three lines,
 * and a longer phrasing pushes the multiplier itself onto the clipped fourth line — the one
 * number the player needs is the one that would disappear.
 */
export function localizedItem(id: ItemId): ItemCard {
  const base = ALL_ITEMS[id];
  const mult = multiplierValue(id);
  return {
    ...base,
    name: t(base.name),
    description: mult === null ? t(base.description) : t('item.booster.desc', { mult })
  };
}

/*
 * Cards are never bought — `getRandomItems` deals them free, uniformly, at the start of a
 * duel and again on every drum reload. There is no price and no purchase decision, so the
 * cards carry no cost field: a stray number here would only invite balance arguments about
 * a shop that does not exist. Chips buy meta upgrades (HP / armour / damage) and nothing else.
 *
 * `name` and `description` hold i18n keys, not text. Nothing renders these fields directly —
 * every hand goes through localizedItem(), which resolves them. Boosters carry the shared
 * 'item.booster.desc' key because their multiplier is filled in from MULTIPLIER_CARDS.
 */
export const ALL_ITEMS: Record<ItemId, ItemCard> = {
  MAGNIFIER: {
    id: 'MAGNIFIER',
    name: 'item.MAGNIFIER.name',
    icon: '🔍',
    iconUrl: magnifierIcon,
    description: 'item.MAGNIFIER.desc'
  },
  SAW: {
    id: 'SAW',
    name: 'item.SAW.name',
    icon: '🪚',
    iconUrl: sawIcon,
    description: 'item.booster.desc'
  },
  ENERGY_DRINK: {
    id: 'ENERGY_DRINK',
    name: 'item.ENERGY_DRINK.name',
    icon: '🍺',
    iconUrl: energyIcon,
    description: 'item.ENERGY_DRINK.desc'
  },
  CIGARETTE: {
    id: 'CIGARETTE',
    name: 'item.CIGARETTE.name',
    icon: '🚬',
    iconUrl: cigaretteIcon,
    description: 'item.CIGARETTE.desc'
  },
  HACK_CHIP: {
    id: 'HACK_CHIP',
    name: 'item.HACK_CHIP.name',
    icon: '⚡',
    iconUrl: hackchipIcon,
    description: 'item.HACK_CHIP.desc'
  },
  MIRROR_SHIELD: {
    id: 'MIRROR_SHIELD',
    name: 'item.MIRROR_SHIELD.name',
    icon: '🛡️',
    iconUrl: shieldIcon,
    description: 'item.MIRROR_SHIELD.desc'
  },
  OVERDRIVE: {
    id: 'OVERDRIVE',
    name: 'item.OVERDRIVE.name',
    icon: '💣',
    iconUrl: overdriveIcon,
    description: 'item.booster.desc'
  },
  MAGNET: {
    id: 'MAGNET',
    name: 'item.MAGNET.name',
    icon: '🧲',
    iconUrl: magnetIcon,
    description: 'item.MAGNET.desc'
  },
  XRAY: {
    id: 'XRAY',
    name: 'item.XRAY.name',
    icon: '🩺',
    iconUrl: xrayIcon,
    description: 'item.XRAY.desc'
  },
  OVERDRIVE_2: {
    id: 'OVERDRIVE_2',
    name: 'item.OVERDRIVE_2.name',
    icon: '⚡',
    iconUrl: overdrive2Icon,
    description: 'item.booster.desc'
  },
  NULLIFIER: {
    id: 'NULLIFIER',
    name: 'item.NULLIFIER.name',
    icon: '🚫',
    iconUrl: nullifierIcon,
    description: 'item.NULLIFIER.desc'
  }
};

export const ALL_RELICS: Relic[] = [
  {
    id: 'NEON_LUCK',
    name: 'Неоновый Клевер',
    icon: '🍀',
    description: 'Каждый 3-й выстрел по себе гарантированно холостой.',
    cost: 120,
    purchased: false
  },
  {
    id: 'SILENT_SAW',
    name: 'Адаптер Урона',
    icon: '⚙️',
    description: '+1 к базовому урону всех боевых патронов.',
    cost: 150,
    purchased: false
  },
  {
    id: 'CYBER_SHIELD',
    name: 'Кибер-Броня',
    icon: '🛡️',
    description: 'Максимальное здоровье +2.',
    cost: 180,
    purchased: false
  }
];

export function getRandomItems(count: number): ItemCard[] {
  const keys = Object.keys(ALL_ITEMS) as ItemId[];
  const result: ItemCard[] = [];
  for (let i = 0; i < count; i++) {
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    result.push(localizedItem(randomKey));
  }
  return result;
}
