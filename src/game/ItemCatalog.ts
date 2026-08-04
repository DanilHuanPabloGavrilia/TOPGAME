import type { ItemCard, ItemId, Relic } from './Types';

export const ALL_ITEMS: Record<ItemId, ItemCard> = {
  MAGNIFIER: {
    id: 'MAGNIFIER',
    name: 'Лупа',
    icon: '🔍',
    iconUrl: '/images/items/magnifier.jpg',
    description: 'Узнать тип следующего патрона в барабане.',
    cost: 30
  },
  SAW: {
    id: 'SAW',
    name: 'Ножовка',
    icon: '🪚',
    iconUrl: '/images/items/saw.jpg',
    description: 'Удваивает урон от следующего выстрела (х2).',
    cost: 45
  },
  ENERGY_DRINK: {
    id: 'ENERGY_DRINK',
    name: 'Энергетик',
    icon: '🍺',
    iconUrl: '/images/items/energy.jpg',
    description: 'Выбросить текущий патрон без выстрела.',
    cost: 35
  },
  CIGARETTE: {
    id: 'CIGARETTE',
    name: 'Сигарета',
    icon: '🚬',
    iconUrl: '/images/items/cigarette.jpg',
    description: 'Восстанавливает 10% от максимального здоровья.',
    cost: 50
  },
  HACK_CHIP: {
    id: 'HACK_CHIP',
    name: 'Хак-чип',
    icon: '⚡',
    iconUrl: '/images/items/hackchip.jpg',
    description: 'Инвертирует текущий патрон (Боевой ↔ Холостой).',
    cost: 60
  },
  MIRROR_SHIELD: {
    id: 'MIRROR_SHIELD',
    name: 'Щит-Зеркало',
    icon: '🛡️',
    iconUrl: '/images/items/shield.jpg',
    description: 'Отражает 1 урон обратно в противника.',
    cost: 55
  },
  CURSED_COIN: {
    id: 'CURSED_COIN',
    name: 'Проклятая монета',
    icon: '🎴',
    iconUrl: '/images/items/coin.jpg',
    description: 'Принудительно передает ход противоположному игроку.',
    cost: 40
  },
  OVERDRIVE: {
    id: 'OVERDRIVE',
    name: 'Овердрайв',
    icon: '💣',
    iconUrl: '/images/items/overdrive.jpg',
    description: 'Тройной урон (х3), но 1 урон себе при холостом.',
    cost: 70
  },
  MAGNET: {
    id: 'MAGNET',
    name: 'Магнит',
    icon: '🧲',
    iconUrl: '/images/items/magnet.jpg',
    description: 'Украсть случайную карту из руки босса.',
    cost: 65
  },
  XRAY: {
    id: 'XRAY',
    name: 'Рентген-Сканер',
    icon: '🩺',
    iconUrl: '/images/items/xray.jpg',
    description: 'Показывает типы ВСЕХ патронов в барабане.',
    cost: 75
  },
  OVERDRIVE_2: {
    id: 'OVERDRIVE_2',
    name: 'Овердрайв 2.0',
    icon: '⚡',
    iconUrl: '/images/items/overdrive2.jpg',
    description: 'Увеличивает урон следующего выстрела в 2.5 раза (х2.5)!',
    cost: 90
  },
  NULLIFIER: {
    id: 'NULLIFIER',
    name: 'Нуллификатор',
    icon: '🚫',
    iconUrl: '/images/items/nullifier.jpg',
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
