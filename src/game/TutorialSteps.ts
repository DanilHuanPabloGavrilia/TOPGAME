import type { TutorialStep } from '../engine/TutorialManager';
import type { GameState } from './GameState';
import { t } from '../i18n';

/**
 * The guided run: meta shop first, then a sparring bout against the trainer.
 *
 * Selectors point at real ids in index.html. Anything rebuilt by renderUI (shop cards,
 * the hand) is addressed through its stable container so the step survives a re-render.
 *
 * Step text is resolved here, at build time, rather than stored as keys: this function is
 * called after boot, so the language is already known and the manager can stay text-only.
 */
export function buildTutorialSteps(gameState: GameState): TutorialStep[] {
  return [
    // ---------------------------------------------------------------- chrome
    {
      screen: 'ANY',
      selector: '#btn-open-guide-header',
      position: 'bottom',
      text: t('tutorial.guide')
    },
    {
      screen: 'ANY',
      selector: '#chips-display',
      position: 'bottom',
      text: t('tutorial.chips')
    },

    // ------------------------------------------------------------- meta shop
    {
      screen: 'META_SHOP',
      selector: '#meta-upgrades-grid .shop-item-card:first-child',
      position: 'bottom',
      text: t('tutorial.upgrades')
    },
    {
      screen: 'META_SHOP',
      selector: '#btn-meta-ad-chips',
      position: 'top',
      text: t('tutorial.adChips')
    },
    {
      screen: 'META_SHOP',
      selector: '#btn-meta-training',
      position: 'top',
      actionRequired: 'click',
      text: t('tutorial.startTraining')
    },

    // ---------------------------------------------------------------- battle
    {
      screen: 'BATTLE',
      selector: '.dealer-zone',
      position: 'bottom',
      text: t('tutorial.opponent')
    },
    {
      screen: 'BATTLE',
      selector: '#revolver-drum',
      position: 'bottom',
      text: t('tutorial.drum')
    },
    {
      screen: 'BATTLE',
      selector: '#cards-container',
      position: 'top',
      text: t('tutorial.hand')
    },
    {
      screen: 'BATTLE',
      selector: '#btn-shoot-self',
      position: 'top',
      actionRequired: 'click',
      text: t('tutorial.shootSelf')
    },
    {
      screen: 'BATTLE',
      selector: '#btn-shoot-dealer',
      position: 'top',
      actionRequired: 'click',
      text: t('tutorial.shootDealer')
    },
    {
      screen: 'BATTLE',
      selector: '.action-controls',
      position: 'top',
      // Resolved by the engine rather than by a click: the bout has to actually finish.
      waitFor: () => gameState.phase !== 'BATTLE',
      text: t('tutorial.finish')
    }
  ];
}
