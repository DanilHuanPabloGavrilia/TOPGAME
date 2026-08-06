import type { ItemCard, ItemId, Relic } from './Types';

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
 * Card text for a booster. Kept short on purpose: `.card-desc` clamps to three lines, and
 * a longer phrasing pushes the multiplier itself onto the clipped fourth line — the one
 * number the player needs is the one that would disappear.
 */
function boosterText(id: ItemId): string {
  return `Урон следующего выстрела — х${multiplierValue(id)}.`;
}

/*
 * Cards are never bought — `getRandomItems` deals them free, uniformly, at the start of a
 * duel and again on every drum reload. There is no price and no purchase decision, so the
 * cards carry no cost field: a stray number here would only invite balance arguments about
 * a shop that does not exist. Chips buy meta upgrades (HP / armour / damage) and nothing else.
 */
export const ALL_ITEMS: Record<ItemId, ItemCard> = {
  MAGNIFIER: {
    id: 'MAGNIFIER',
    name: 'Лупа',
    icon: '🔍',
    iconUrl: magnifierIcon,
    description: 'Узнать тип следующего патрона в барабане.'
  },
  SAW: {
    id: 'SAW',
    name: 'Ножовка',
    icon: '🪚',
    iconUrl: sawIcon,
    description: boosterText('SAW')
  },
  ENERGY_DRINK: {
    id: 'ENERGY_DRINK',
    name: 'Энергетик',
    icon: '🍺',
    iconUrl: energyIcon,
    description: 'Выбросить текущий патрон без выстрела.'
  },
  CIGARETTE: {
    id: 'CIGARETTE',
    name: 'Сигарета',
    icon: '🚬',
    iconUrl: cigaretteIcon,
    description: 'Восстанавливает 10% от максимального здоровья, но не меньше 10.'
  },
  HACK_CHIP: {
    id: 'HACK_CHIP',
    name: 'Хак-чип',
    icon: '⚡',
    iconUrl: hackchipIcon,
    description: 'Инвертирует текущий патрон (Боевой ↔ Холостой).'
  },
  MIRROR_SHIELD: {
    id: 'MIRROR_SHIELD',
    name: 'Щит-Зеркало',
    icon: '🛡️',
    iconUrl: shieldIcon,
    description: 'Отражает следующий выстрел обратно в стрелка.'
  },
  OVERDRIVE: {
    id: 'OVERDRIVE',
    name: 'Овердрайв',
    icon: '💣',
    iconUrl: overdriveIcon,
    description: boosterText('OVERDRIVE')
  },
  MAGNET: {
    id: 'MAGNET',
    name: 'Магнит',
    icon: '🧲',
    iconUrl: magnetIcon,
    description: 'Украсть случайную карту из руки босса.'
  },
  XRAY: {
    id: 'XRAY',
    name: 'Рентген-Сканер',
    icon: '🩺',
    iconUrl: xrayIcon,
    description: 'Показывает типы ВСЕХ патронов в барабане.'
  },
  OVERDRIVE_2: {
    id: 'OVERDRIVE_2',
    name: 'Овердрайв 2.0',
    icon: '⚡',
    iconUrl: overdrive2Icon,
    description: boosterText('OVERDRIVE_2')
  },
  NULLIFIER: {
    id: 'NULLIFIER',
    name: 'Нуллификатор',
    icon: '🚫',
    iconUrl: nullifierIcon,
    description: 'Сбрасывает множитель урона и сжигает карту противника.'
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
    result.push({ ...ALL_ITEMS[randomKey] });
  }
  return result;
}
