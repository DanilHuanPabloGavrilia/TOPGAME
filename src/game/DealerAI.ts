import type { ChamberState, ItemCard, ItemId } from './Types';

export interface AIDecision {
  action: 'SHOOT_PLAYER' | 'SHOOT_SELF' | 'USE_ITEM';
  itemIndex?: number;
}

/**
 * Everything the dealer is allowed to reason about. Deliberately excludes the raw contents
 * of chamber.bullets beyond the counts the drum already displays, and reads its own
 * dealerKnownBullets rather than the player's — the AI plays on public information plus
 * whatever it paid a card to learn.
 */
export interface AIContext {
  chamber: ChamberState;
  dealerHand: ItemCard[];
  /** The player's hand is face-up on the table, so targeting it is fair game. */
  playerHand: ItemCard[];
  dealerHp: number;
  dealerMaxHp: number;
  playerHp: number;
  playerArmor: number;
  /** Current damage multiplier — shown on screen, so public. */
  damageMultiplier: number;
  dealerShieldUp: boolean;
}

/** Ranked worst-to-face-across-the-table, for Nullifier burns and Magnet steals. */
const THREAT_ORDER: ItemId[] = [
  'OVERDRIVE_2',
  'OVERDRIVE',
  'SAW',
  'XRAY',
  'HACK_CHIP',
  'MIRROR_SHIELD',
  'MAGNIFIER',
  'CIGARETTE',
  'MAGNET',
  'NULLIFIER',
  'ENERGY_DRINK'
];

export function threatRank(id: ItemId): number {
  const i = THREAT_ORDER.indexOf(id);
  return i === -1 ? THREAT_ORDER.length : i;
}

/** Index of the card in `hand` that hurts most to leave in play. */
export function mostDangerousCardIndex(hand: ItemCard[]): number {
  let best = 0;
  for (let i = 1; i < hand.length; i++) {
    if (threatRank(hand[i].id) < threatRank(hand[best].id)) best = i;
  }
  return best;
}

// Damage multipliers, strongest first. Only one can be active — the field is overwritten,
// not stacked — so the dealer always reaches for the biggest it holds.
const MULTIPLIER_CARDS: { id: ItemId; value: number }[] = [
  { id: 'OVERDRIVE_2', value: 4 },
  { id: 'OVERDRIVE', value: 3 },
  { id: 'SAW', value: 2 }
];

const HEAL_THRESHOLD = 0.5;    // smoke once half the health bar is gone
const PANIC_THRESHOLD = 0.35;  // below this, survival outranks aggression
const SHIELD_THRESHOLD = 0.45; // raise the mirror while a reflected round still matters

export class DealerAI {
  static getDialogue(event: 'START' | 'PLAYER_SHOOT_DEALER_LIVE' | 'PLAYER_SHOOT_DEALER_BLANK' | 'PLAYER_SHOOT_SELF_LIVE' | 'PLAYER_SHOOT_SELF_BLANK' | 'DEALER_TURN' | 'WIN' | 'LOSE'): string {
    const dialogues: Record<string, string[]> = {
      START: [
        'Добро пожаловать в полуночную секцию. Правила просты: выживи.',
        'Удача любит тех, кто умеет считать шансы...',
        'Ставки сделаны. Барабан заряжен.'
      ],
      PLAYER_SHOOT_DEALER_LIVE: [
        'Угх... Точное попадание. Неплохо.',
        'Твой азарт начинает меня забавлять.',
        'Больно, но игра только начинается.'
      ],
      PLAYER_SHOOT_DEALER_BLANK: [
        'Мимо. Удача сегодня не на твоей стороне.',
        'Щелчок... Холостой! Мой ход.',
        'Ошибочка. Теперь черед моих ходов.'
      ],
      PLAYER_SHOOT_SELF_LIVE: [
        'Опасный риск... и расплата за него!',
        'Стрелять в себя — авантюра, которая не выгорела.',
        'Самоуверенность убивает быстрее пуль.'
      ],
      PLAYER_SHOOT_SELF_BLANK: [
        'Холостой по себе! Ты сохраняешь ход... Впечатляет.',
        'Отличный просчет! Твой ход продолжается.',
        'Нервы из стали.'
      ],
      DEALER_TURN: [
        'Теперь посмотри, как играют профессионалы...',
        'Мой черед. Барабан шепчет мне отгадку.',
        'Оценим твои шансы выжить...'
      ],
      WIN: [
        'Невозможно... Ты переиграл меня.',
        'Твоя синергия уничтожила меня. Забирай банк.'
      ],
      LOSE: [
        'Казино всегда остается в плюсе.',
        'Твоя игра окончена. Попробуешь снова?'
      ]
    };

    const list = dialogues[event] || dialogues['START'];
    return list[Math.floor(Math.random() * list.length)];
  }

  static decideTurn(ctx: AIContext): AIDecision {
    const { chamber, dealerHand, playerHand, dealerHp, dealerMaxHp, playerHp, playerArmor } = ctx;

    const find = (id: ItemId) => dealerHand.findIndex(c => c.id === id);
    const use = (idx: number): AIDecision => ({ action: 'USE_ITEM', itemIndex: idx });

    const remaining = chamber.bullets.slice(chamber.currentIndex);
    const total = remaining.length;
    if (total === 0) return { action: 'SHOOT_PLAYER' };

    // Counts are public — the drum prints them. Which specific round is next is not.
    const liveCount = remaining.filter(b => b === 'LIVE').length;
    const liveProb = liveCount / total;
    const known = chamber.dealerKnownBullets[chamber.currentIndex] ?? null;
    const roundIsLive = known === 'LIVE' || (known === null && liveProb > 0.5);

    // --- 1. Survival first. A dead dealer plays no combos. ---
    if (dealerHp <= dealerMaxHp * PANIC_THRESHOLD) {
      const cig = find('CIGARETTE');
      if (cig !== -1) return use(cig);

      const shield = find('MIRROR_SHIELD');
      if (shield !== -1 && !ctx.dealerShieldUp) return use(shield);
    }

    // --- 2. Go for the kill when the round can finish the player. ---
    const playerEffectiveHp = playerHp + playerArmor;
    if (roundIsLive) {
      const multiplier = MULTIPLIER_CARDS
        .map(m => ({ ...m, idx: find(m.id) }))
        .find(m => m.idx !== -1);

      if (multiplier && ctx.damageMultiplier === 1) {
        // Always worth it on a confirmed live round; on a gamble, only when it converts
        // into an actual kill rather than burning the card for chip damage.
        const confident = known === 'LIVE' || liveProb >= 0.75;
        if (confident || playerEffectiveHp <= 40) return use(multiplier.idx);
      }
      return { action: 'SHOOT_PLAYER' };
    }

    // --- 3. Blind. Buy information before committing. ---
    if (known === null) {
      // X-ray reads the whole cylinder, so it earns its slot while rounds remain.
      const xray = find('XRAY');
      if (xray !== -1 && total >= 3) return use(xray);

      const mag = find('MAGNIFIER');
      if (mag !== -1) return use(mag);
    }

    // --- 4. Known blank: turn it into a live one, or eat it for a free extra turn. ---
    if (known === 'BLANK') {
      const hack = find('HACK_CHIP');
      if (hack !== -1) return use(hack); // next pass takes the kill branch above
    }

    // --- 5. The round is a dud, and a blank into our own head keeps the turn anyway.
    // Spend the free tempo on the player's hand and on topping ourselves up. ---
    if (find('CIGARETTE') !== -1 && dealerHp <= dealerMaxHp * HEAL_THRESHOLD) {
      return use(find('CIGARETTE'));
    }

    // Never nullify while our own multiplier is standing — it would wipe our buff too.
    const nullifier = find('NULLIFIER');
    if (nullifier !== -1 && ctx.damageMultiplier === 1 && playerHand.length > 0) {
      const worst = playerHand[mostDangerousCardIndex(playerHand)];
      if (threatRank(worst.id) <= threatRank('HACK_CHIP')) return use(nullifier);
    }

    const magnet = find('MAGNET');
    if (magnet !== -1 && playerHand.length > 0) return use(magnet);

    const shield = find('MIRROR_SHIELD');
    if (shield !== -1 && !ctx.dealerShieldUp && dealerHp <= dealerMaxHp * SHIELD_THRESHOLD) {
      return use(shield);
    }

    // Middling odds: skip the round rather than gamble our own health on it.
    const drink = find('ENERGY_DRINK');
    if (drink !== -1 && known === null && liveProb > 0.3) return use(drink);

    return { action: 'SHOOT_SELF' };
  }
}
