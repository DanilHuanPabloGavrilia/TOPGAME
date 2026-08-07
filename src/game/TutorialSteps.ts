import type { TutorialStep } from '../engine/TutorialManager';
import type { GameState } from './GameState';

/**
 * The guided run: meta shop first, then a sparring bout against the trainer.
 *
 * Selectors point at real ids in index.html. Anything rebuilt by renderUI (shop cards,
 * the hand) is addressed through its stable container so the step survives a re-render.
 */
export function buildTutorialSteps(gameState: GameState): TutorialStep[] {
  return [
    // ---------------------------------------------------------------- chrome
    {
      screen: 'ANY',
      selector: '#btn-open-guide-header',
      position: 'bottom',
      text: 'Добро пожаловать в Dealer\'s Gambit! Если забудете правила — Руководство всегда здесь, в шапке.'
    },
    {
      screen: 'ANY',
      selector: '#chips-display',
      position: 'bottom',
      text: 'Это ваши фишки. Их зарабатывают в дуэлях и тратят на постоянные улучшения.'
    },

    // ------------------------------------------------------------- meta shop
    {
      screen: 'META_SHOP',
      selector: '#meta-upgrades-grid .shop-item-card:first-child',
      position: 'bottom',
      text: 'Здесь прокачивают максимальное здоровье. Такие улучшения остаются с вами даже после поражения.'
    },
    {
      screen: 'META_SHOP',
      selector: '#btn-meta-ad-chips',
      position: 'top',
      text: 'Не хватает на апгрейд? Можно посмотреть рекламу и получить фишки. Три раза за пять минут.'
    },
    {
      screen: 'META_SHOP',
      selector: '#btn-meta-training',
      position: 'top',
      actionRequired: 'click',
      text: 'А теперь — за стол. ILSHMONSTER бьёт вполсилы, на нём и разберёмся. Нажмите кнопку.'
    },

    // ---------------------------------------------------------------- battle
    {
      screen: 'BATTLE',
      selector: '.dealer-zone',
      position: 'bottom',
      text: 'Ваш противник и его здоровье. Опустите полосу до нуля — и бой выигран.'
    },
    {
      screen: 'BATTLE',
      selector: '#revolver-drum',
      position: 'bottom',
      text: 'Барабан револьвера. Золотом отмечен патрон, который выстрелит следующим, а счётчик под ним показывает, сколько боевых 🔴 и холостых 🔵 осталось.'
    },
    {
      screen: 'BATTLE',
      selector: '#cards-container',
      position: 'top',
      text: 'Ваша рука. Лупа показывает текущий патрон, Ножовка удваивает урон, Сигарета лечит. Карта тратится сразу и хода не отнимает.'
    },
    {
      screen: 'BATTLE',
      selector: '#btn-shoot-self',
      position: 'top',
      actionRequired: 'click',
      text: 'Главное правило: выстрел в себя холостым не ранит, оставляет ход вам и приносит фишки. Сейчас в стволе холостой — рискните.'
    },
    {
      screen: 'BATTLE',
      selector: '#btn-shoot-dealer',
      position: 'top',
      actionRequired: 'click',
      text: 'Видите? Ход остался за вами. А выстрел в противника наносит урон, но передаёт ход ему. Стреляйте.'
    },
    {
      screen: 'BATTLE',
      selector: '.action-controls',
      position: 'top',
      // Resolved by the engine rather than by a click: the bout has to actually finish.
      waitFor: () => gameState.phase !== 'BATTLE',
      text: 'Дальше вы сами. Считайте патроны, пользуйтесь картами и добейте тренера — обучение закончится вместе с боем.'
    }
  ];
}
