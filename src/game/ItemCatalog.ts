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

export const ALL_ITEMS: Record<ItemId, ItemCard> = {
  MAGNIFIER: {
    id: 'MAGNIFIER',
    name: 'Лупа',
    icon: '🔍',
    iconUrl: magnifierIcon,
    description: 'Узнать тип следующего патрона в барабане.',
    cost: 30
  },
  SAW: {
    id: 'SAW',
    name: 'Ножовка',
    icon: '🪚',
    iconUrl: sawIcon,
    description: 'Удваивает урон от следующего выстрела (х2).',
    cost: 45
  },
  ENERGY_DRINK: {
    id: 'ENERGY_DRINK',
    name: 'Энергетик',
    icon: '🍺',
    iconUrl: energyIcon,
    description: 'Выбросить текущий патрон без выстрела.',
    cost: 35
  },
  CIGARETTE: {
    id: 'CIGARETTE',
    name: 'Сигарета',
    icon: '🚬',
    iconUrl: cigaretteIcon,
    description: 'Восстанавливает 10% от максимального здоровья.',
    cost: 50
  },
  HACK_CHIP: {
    id: 'HACK_CHIP',
    name: 'Хак-чип',
    icon: '⚡',
    iconUrl: hackchipIcon,
    description: 'Инвертирует текущий патрон (Боевой ↔ Холостой).',
    cost: 60
  },
  MIRROR_SHIELD: {
    id: 'MIRROR_SHIELD',
    name: 'Щит-Зеркало',
    icon: '🛡️',
    iconUrl: shieldIcon,
    description: 'Отражает 1 урон обратно в противника.',
    cost: 55
  },
  OVERDRIVE: {
    id: 'OVERDRIVE',
    name: 'Овердрайв',
    icon: '💣',
    iconUrl: overdriveIcon,
    description: 'Тройной урон (х3), но 1 урон себе при холостом.',
    cost: 70
  },
  MAGNET: {
    id: 'MAGNET',
    name: 'Магнит',
    icon: '🧲',
    iconUrl: magnetIcon,
    description: 'Украсть случайную карту из руки босса.',
    cost: 65
  },
  XRAY: {
    id: 'XRAY',
    name: 'Рентген-Сканер',
    icon: '🩺',
    iconUrl: xrayIcon,
    description: 'Показывает типы ВСЕХ патронов в барабане.',
    cost: 75
  },
  OVERDRIVE_2: {
    id: 'OVERDRIVE_2',
    name: 'Овердрайв 2.0',
    icon: '⚡',
    iconUrl: overdrive2Icon,
    description: 'Увеличивает урон следующего выстрела в 2.5 раза (х2.5)!',
    cost: 90
  },
  NULLIFIER: {
    id: 'NULLIFIER',
    name: 'Нуллификатор',
    icon: '🚫',
    iconUrl: nullifierIcon,
    description: 'Сбрасывает урон босса и удаляет его карту.',
    cost: 80
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
