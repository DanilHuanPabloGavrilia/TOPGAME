import type { ChamberState, ItemCard } from './Types';

export interface AIDecision {
  action: 'SHOOT_PLAYER' | 'SHOOT_SELF' | 'USE_ITEM';
  itemIndex?: number;
}

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

  static decideTurn(
    chamber: ChamberState,
    dealerHand: ItemCard[],
    dealerHp: number,
    playerHp: number,
    dealerMaxHp?: number
  ): AIDecision {
    const remaining = chamber.bullets.slice(chamber.currentIndex);
    const knownCurrent = chamber.knownBullets[chamber.currentIndex];
    
    let liveCount = 0;
    let blankCount = 0;

    remaining.forEach(b => {
      if (b === 'LIVE') liveCount++;
      else blankCount++;
    });

    const total = remaining.length;
    if (total === 0) return { action: 'SHOOT_PLAYER' };

    // 0. If Dealer HP is damaged and has Cigarette, smoke to heal!
    const cigIdx = dealerHand.findIndex(c => c.id === 'CIGARETTE');
    if (cigIdx !== -1 && dealerHp < (dealerMaxHp || 99)) {
      return { action: 'USE_ITEM', itemIndex: cigIdx };
    }

    const liveProb = liveCount / total;

    // Finish off low HP player if chance is good!
    if (playerHp <= 2 && (knownCurrent === 'LIVE' || liveProb >= 0.5)) {
      const sawIdx = dealerHand.findIndex(c => c.id === 'SAW');
      if (sawIdx !== -1) {
        return { action: 'USE_ITEM', itemIndex: sawIdx };
      }
      return { action: 'SHOOT_PLAYER' };
    }

    // 1. If we have a Magnifier and don't know the current bullet, use it first!
    if (knownCurrent === null) {
      const magIdx = dealerHand.findIndex(c => c.id === 'MAGNIFIER');
      if (magIdx !== -1) {
        return { action: 'USE_ITEM', itemIndex: magIdx };
      }
    }

    // 2. If we KNOW the bullet is LIVE
    if (knownCurrent === 'LIVE') {
      // Use Saw if we have it to double damage
      const sawIdx = dealerHand.findIndex(c => c.id === 'SAW');
      if (sawIdx !== -1) {
        return { action: 'USE_ITEM', itemIndex: sawIdx };
      }
      return { action: 'SHOOT_PLAYER' };
    }

    // 3. If we KNOW the bullet is BLANK
    if (knownCurrent === 'BLANK') {
      // Use Hack chip if we have it to make it live and shoot player
      const hackIdx = dealerHand.findIndex(c => c.id === 'HACK_CHIP');
      if (hackIdx !== -1) {
        return { action: 'USE_ITEM', itemIndex: hackIdx };
      }
      // Otherwise shoot self for an extra turn!
      return { action: 'SHOOT_SELF' };
    }

    // 4. Unknown bullet logic based on probability
    if (liveProb > 0.5) {
      // High chance of Live -> shoot player
      const sawIdx = dealerHand.findIndex(c => c.id === 'SAW');
      if (sawIdx !== -1 && liveProb >= 0.75) {
        return { action: 'USE_ITEM', itemIndex: sawIdx };
      }
      return { action: 'SHOOT_PLAYER' };
    } else {
      // Low chance of Live (high chance of Blank) -> shoot self to keep turn
      const drinkIdx = dealerHand.findIndex(c => c.id === 'ENERGY_DRINK');
      if (drinkIdx !== -1 && liveProb > 0.3) {
        return { action: 'USE_ITEM', itemIndex: drinkIdx };
      }
      return { action: 'SHOOT_SELF' };
    }
  }
}
