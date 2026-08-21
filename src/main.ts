// Self-hosted fonts. Only the weights the stylesheet asks for, and only the subsets the
// shipped languages need. Fira Code carries all body copy:
//   latin        — English, and the ASCII half of Turkish/Uzbek
//   latin-ext    — Turkish ş ğ ı İ and Uzbek oʻ gʻ  (без него они рисуются квадратами)
//   cyrillic     — Russian
//   cyrillic-ext — Kazakh ә ғ қ ң ө ұ ү һ і      (тоже отдельный блок, не входит в cyrillic)
// Orbitron is display type with no coverage beyond basic Latin — see style.css for why the
// headings no longer depend on it alone.
import '@fontsource/fira-code/latin-400.css';
import '@fontsource/fira-code/latin-700.css';
import '@fontsource/fira-code/latin-ext-400.css';
import '@fontsource/fira-code/latin-ext-700.css';
import '@fontsource/fira-code/cyrillic-400.css';
import '@fontsource/fira-code/cyrillic-700.css';
import '@fontsource/fira-code/cyrillic-ext-400.css';
import '@fontsource/fira-code/cyrillic-ext-700.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-800.css';
import '@fontsource/orbitron/latin-900.css';

import './style.css';
import { GameState, formatHp, BOSS_REWARDS, defeatReward, hpUpgradeCost, armorUpgradeCost, damageUpgradeCost, AD_CHIPS_MAX_IN_WINDOW, BLANK_SELF_SHOT_CHIPS, DEFEAT_SHARE } from './game/GameState';
import { ParticleSystem } from './engine/ParticleSystem';
import { LOCATIONS, localizedBoss, localizedLocation } from './game/BossCatalog';
import { sound } from './engine/AudioSynthesizer';
import { platformSDK } from './engine/PlatformSDK';
import { imagePreloader } from './engine/ImagePreloader';
import { saveManager } from './engine/SaveManager';
import { tutorial, type TutorialScreen } from './engine/TutorialManager';
import { normalizeLang, setLang, getLang, t, type Lang } from './i18n';
import { applyStaticI18n } from './i18n/dom';
import { buildTutorialSteps } from './game/TutorialSteps';

imagePreloader.preloadAll();

// Initialize Canvas Particles
const canvas = document.getElementById('fx-canvas') as HTMLCanvasElement;
const particles = new ParticleSystem(canvas);

// Initialize Game State
const gameState = new GameState();

// Dev-only handle for poking at a duel from the console. Vite strips this from the
// production build, so nothing is exposed to players.
if (import.meta.env.DEV) {
  (window as unknown as { gameState: GameState }).gameState = gameState;
}

// DOM Screens
const screenMainMenu = document.getElementById('screen-main-menu')!;
const screenWorldMap = document.getElementById('screen-world-map')!;
const screenMetaShop = document.getElementById('screen-meta-shop')!;
const screenBattle = document.getElementById('screen-battle')!;

// Header Elements
const chipsDisplay = document.getElementById('chips-display')!;
const stageDisplay = document.getElementById('stage-display')!;
const btnSoundToggle = document.getElementById('btn-sound-toggle')!;

// Main Menu Elements
const btnStartGame = document.getElementById('btn-start-game')!;
const btnOpenMetaShop = document.getElementById('btn-open-meta-shop')!;

// World Map Elements
const locationsList = document.getElementById('locations-list')!;
const btnMapBackMenu = document.getElementById('btn-map-back-menu')!;
const btnMapMetaShop = document.getElementById('btn-map-meta-shop')!;

// Meta Shop Elements
const metaUpgradesGrid = document.getElementById('meta-upgrades-grid')!;
const btnMetaBackMap = document.getElementById('btn-meta-back-map')!;

// Battle Elements
const dealerAvatar = document.getElementById('dealer-avatar')!;
const dealerName = document.getElementById('dealer-name')!;
const dealerHpFill = document.getElementById('dealer-hp-fill')!;
const dealerHpText = document.getElementById('dealer-hp-text')!;
const dealerDialogue = document.getElementById('dealer-dialogue')!;
const dealerCardsContainer = document.getElementById('dealer-cards-container')!;

const playerHpFill = document.getElementById('player-hp-fill')!;
const playerHpText = document.getElementById('player-hp-text')!;
const turnIndicator = document.getElementById('turn-indicator')!;

const bulletIndicators = document.getElementById('bullet-indicators')!;
const liveCountDisplay = document.getElementById('live-count')!;
const blankCountDisplay = document.getElementById('blank-count')!;
const multiplierBadge = document.getElementById('multiplier-badge')!;

const btnShootDealer = document.getElementById('btn-shoot-dealer') as HTMLButtonElement;
const btnShootSelf = document.getElementById('btn-shoot-self') as HTMLButtonElement;
const cardsContainer = document.getElementById('cards-container')!;

const modalOverlay = document.getElementById('modal-overlay')!;
const modalTitle = document.getElementById('modal-title')!;
const modalDesc = document.getElementById('modal-desc')!;
const shopGrid = document.getElementById('shop-grid')!;
const btnModalAction = document.getElementById('btn-modal-action') as HTMLButtonElement;

// Matches the stylesheet's short-screen breakpoint. Held as a MediaQueryList rather than
// re-measured per frame, and listened to so turning the phone repaints the dealer's hand
// instead of leaving whichever form was drawn last.
const compactDealerHand = window.matchMedia('(max-height: 560px), (max-width: 380px)');
compactDealerHand.addEventListener('change', () => gameState.notifyUpdate());

// Main UI Render Pipeline
function renderUI() {
  // Tell the platform whether the player is duelling right now. Decided before the branches
  // below, because the outcome branches launch an interstitial and Yandex wants gameplay
  // reported as stopped before an ad opens, not after.
  if (gameState.screenState === 'BATTLE' && gameState.phase === 'BATTLE') {
    platformSDK.gameplayStart();
  } else {
    platformSDK.gameplayStop();
  }

  // Screen Switcher
  [screenMainMenu, screenWorldMap, screenMetaShop, screenBattle].forEach(s => s.classList.remove('active'));

  // The ad countdown only needs to tick while its button is on screen; renderMetaShop
  // starts it again below.
  stopAdChipsTicker();

  if (gameState.screenState === 'MAIN_MENU') {
    screenMainMenu.classList.add('active');
  } else if (gameState.screenState === 'WORLD_MAP') {
    screenWorldMap.classList.add('active');
    renderWorldMap();
  } else if (gameState.screenState === 'META_SHOP') {
    screenMetaShop.classList.add('active');
    renderMetaShop();
  } else if (gameState.screenState === 'BATTLE') {
    screenBattle.classList.add('active');
    renderBattleUI();
  }

  // The tutorial parks itself when its step belongs to a screen that is not open, so it
  // has to hear about every switch. The boss dossier is a modal and reports separately.
  if (!document.getElementById('modal-boss-intro')!.classList.contains('active')) {
    tutorial.changeScreen(gameState.screenState as TutorialScreen);
  }

  // The Guide belongs to the part of the session where the player is still finding their
  // feet. Inside a duel it is dead weight, and on a phone it was worse than that: it pushed
  // the Back button off the right edge of the header, so there was no visible way out of a
  // fight. Hidden during battle, the header fits and Back is reachable again.
  const btnGuideHeader = document.getElementById('btn-open-guide-header');
  if (btnGuideHeader) {
    btnGuideHeader.style.display = gameState.screenState === 'BATTLE' ? 'none' : '';
  }

  // Header Stats
  chipsDisplay.innerText = `${gameState.player.chips} $`;
  stageDisplay.innerText = t('ui.header.stageValue', {
    loc: gameState.currentLocationIndex + 1,
    boss: gameState.currentBossIndex + 1
  });
}

// Render Battle Table UI
function renderBattleUI() {
  const loc = LOCATIONS[gameState.currentLocationIndex];
  if (loc && document.getElementById('app')) {
    document.getElementById('app')!.style.background = loc.bgGradient;
  }

  // Dealer. Read the portrait off the dealer we are actually fighting — indexing into
  // LOCATIONS showed the training partner whichever boss shared his slot on the map.
  if (gameState.dealer.avatarUrl) {
    dealerAvatar.innerHTML = `<img src="${gameState.dealer.avatarUrl}" class="boss-avatar-img" alt="${gameState.dealer.name}" />`;
  } else {
    dealerAvatar.innerText = gameState.dealer.avatar;
  }

  dealerName.innerText = gameState.dealer.name;
  const dealerHpPct = Math.max(0, (gameState.dealer.hp / gameState.dealer.maxHp) * 100);
  dealerHpFill.style.width = `${dealerHpPct}%`;
  dealerHpText.innerText = t('ui.battle.hp', {
    cur: formatHp(gameState.dealer.hp),
    max: formatHp(gameState.dealer.maxHp),
    armor: formatHp(gameState.dealer.armor)
  });
  dealerDialogue.innerText = `"${gameState.dealer.dialogue}"`;

  // Render Combat Log
  const combatLogEntries = document.getElementById('combat-log-entries');
  if (combatLogEntries) {
    combatLogEntries.innerHTML = gameState.combatLog.map(entry => `<div>${entry}</div>`).join('');
  }

  // Dealer Hand Cards (Static, no bobbing/movement)
  //
  // A boss with a full hand draws nine 30px backs — over 300px of a phone's width, and the
  // strip refuses to shrink, so it squeezed everything beside it. How many cards the
  // opponent holds is the tactical fact; nine identical rectangles are just the decorative
  // way of saying it. Below the short-screen breakpoint they collapse to a count.
  dealerCardsContainer.innerHTML = '';
  const cardCount = gameState.dealer.hand.length;

  if (compactDealerHand.matches) {
    if (cardCount > 0) {
      const badge = document.createElement('div');
      badge.style.cssText = 'display: flex; align-items: center; gap: 3px; padding: 3px 8px; border: 1px solid var(--neon-red); border-radius: 8px; background: rgba(255, 42, 109, 0.12); font-size: 0.78rem; font-weight: 700; color: var(--neon-red); white-space: nowrap;';
      badge.innerText = `🎴 ×${cardCount}`;
      dealerCardsContainer.appendChild(badge);
    }
  } else {
    gameState.dealer.hand.forEach(() => {
      const card = document.createElement('div');
      card.style.cssText = 'width: 30px; height: 42px; background: linear-gradient(135deg, #1f112b, #ff2a6d); border: 1px solid var(--neon-red); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 0.85rem; box-shadow: 0 0 8px rgba(255, 42, 109, 0.3);';
      card.innerText = '🎴';
      dealerCardsContainer.appendChild(card);
    });
  }

  // Player
  const playerHpPct = Math.max(0, (gameState.player.hp / gameState.player.maxHp) * 100);
  playerHpFill.style.width = `${playerHpPct}%`;
  playerHpText.innerText = t('ui.battle.hp', {
    cur: formatHp(gameState.player.hp),
    max: formatHp(gameState.player.maxHp),
    armor: formatHp(gameState.player.armor)
  });

  // Turn
  const isPlayerTurn = gameState.turn === 'PLAYER' && gameState.phase === 'BATTLE';
  turnIndicator.innerText = isPlayerTurn ? t('ui.battle.turn.player') : t('ui.battle.turn.dealer');
  turnIndicator.style.color = isPlayerTurn ? 'var(--neon-green)' : 'var(--neon-red)';

  btnShootDealer.disabled = !isPlayerTurn;
  btnShootSelf.disabled = !isPlayerTurn;

  // Multiplier Badge
  if (gameState.damageMultiplier > 1) {
    multiplierBadge.style.display = 'block';
    multiplierBadge.innerText = t('ui.battle.multiplier', { mult: gameState.damageMultiplier });
  } else {
    multiplierBadge.style.display = 'none';
  }

  // Circular Revolver Drum Positioning & Rotation
  bulletIndicators.innerHTML = '';
  let liveNum = 0;
  let blankNum = 0;
  const totalBullets = gameState.chamber.bullets.length;
  // Derived from the drum's rendered size, not hardcoded: the cylinder shrinks on narrow
  // screens, and a fixed radius would throw the chambers outside the ring.
  // offsetWidth, not clientWidth: the drum has a 3px border and box-sizing:border-box,
  // so clientWidth would report 99 for a 105px cylinder and pull the chambers inward.
  const drumSize = document.getElementById('revolver-drum')?.offsetWidth || 105;
  const radius = Math.round(drumSize * (36 / 105));

  gameState.chamber.bullets.forEach((bullet, idx) => {
    const isPast = idx < gameState.chamber.currentIndex;
    const isCurrent = idx === gameState.chamber.currentIndex;
    const known = gameState.chamber.knownBullets[idx];

    const indicator = document.createElement('div');
    indicator.className = 'bullet-indicator';

    // Calculate Radial Angle (0 is at top: -90 deg)
    const angleRad = (idx / totalBullets) * 2 * Math.PI - Math.PI / 2;
    const x = Math.round(Math.cos(angleRad) * radius);
    const y = Math.round(Math.sin(angleRad) * radius);

    let scale = isCurrent ? 1.35 : 1;
    indicator.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

    if (isPast) {
      indicator.style.opacity = '0.25';
    } else {
      if (bullet === 'LIVE') liveNum++;
      else blankNum++;

      if (isCurrent) {
        indicator.style.borderColor = 'var(--gold)';
        indicator.style.boxShadow = '0 0 16px var(--gold)';
      }

      if (known === 'LIVE') indicator.classList.add('live');
      else if (known === 'BLANK') indicator.classList.add('blank');
      else indicator.classList.add('unknown');
    }

    bulletIndicators.appendChild(indicator);
  });

  // Rotate entire drum so current bullet is aligned at the top (0 deg)
  const currentRotDeg = -(gameState.chamber.currentIndex / totalBullets) * 360;
  bulletIndicators.style.transform = `rotate(${currentRotDeg}deg)`;

  liveCountDisplay.innerText = `🔴 ${liveNum}`;
  blankCountDisplay.innerText = `🔵 ${blankNum}`;

  // Player Cards
  cardsContainer.innerHTML = '';
  const cardTooltip = document.getElementById('card-tooltip')!;
  const tooltipTitle = document.getElementById('tooltip-title')!;
  const tooltipDesc = document.getElementById('tooltip-desc')!;

  gameState.player.hand.forEach((item, idx) => {
    const cardEl = document.createElement('div');
    const playable = gameState.canUseItem(item);
    cardEl.className = playable ? 'item-card' : 'item-card locked';

    const imgSrc = imagePreloader.getItemImage(item.id, item.iconUrl || '');
    const iconHTML = item.iconUrl
      ? `<img src="${imgSrc}" class="item-card-icon-img" alt="${item.name}" loading="eager" decoding="async" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" /><div class="card-icon" style="display:none;">${item.icon}</div>`
      : `<div class="card-icon">${item.icon}</div>`;

    cardEl.innerHTML = `
      ${iconHTML}
      <div class="card-name" style="margin-top: 4px;">${item.name}</div>
      <div class="card-desc">${item.description}</div>
    `;

    // Tooltip Hover Events
    const showTooltip = () => {
      tooltipTitle.innerText = `${item.name}`;
      tooltipDesc.innerText = playable
        ? item.description
        : t('ui.card.locked.tip', { mult: gameState.damageMultiplier });

      const rect = cardEl.getBoundingClientRect();
      const appRect = document.getElementById('app')!.getBoundingClientRect();

      cardTooltip.style.left = `${rect.left - appRect.left + rect.width / 2 - 110}px`;
      cardTooltip.style.top = `${rect.top - appRect.top - 75}px`;
      cardTooltip.classList.add('active');
    };

    const hideTooltip = () => {
      cardTooltip.classList.remove('active');
    };

    cardEl.addEventListener('mouseenter', showTooltip);
    cardEl.addEventListener('mouseleave', hideTooltip);
    cardEl.addEventListener('touchstart', showTooltip);
    cardEl.addEventListener('touchend', hideTooltip);

    cardEl.addEventListener('click', () => {
      hideTooltip();
      if (isPlayerTurn && playable) {
        const rect = cardEl.getBoundingClientRect();
        particles.spawnBurst(rect.left + rect.width / 2, rect.top, '#05d9e8', 20);
        gameState.useItem(idx, 'PLAYER');
      }
    });

    cardsContainer.appendChild(cardEl);
  });

  // Shop / Intermission / GameOver Modals
  const btnAdDoubleChips = document.getElementById('btn-ad-double-chips') as HTMLButtonElement;
  const btnAdRevive = document.getElementById('btn-ad-revive') as HTMLButtonElement;

  // The two nav buttons live in the modal markup and no other branch touches them, so their
  // visibility is reset here on every render. Hiding one without this would hide it for the
  // rest of the run — the intermission hub would quietly lose its way out.
  const btnIntermissionMeta = document.getElementById('btn-intermission-meta') as HTMLButtonElement;
  const btnIntermissionMap = document.getElementById('btn-intermission-map') as HTMLButtonElement;
  if (btnIntermissionMeta) btnIntermissionMeta.style.display = '';
  if (btnIntermissionMap) btnIntermissionMap.style.display = '';

  // Sparring gets its own end screens. The normal ones quote a payout and offer to double
  // it, which would be a lie here — training pays nothing and unlocks nothing.
  if (gameState.isTrainingBattle && (gameState.phase === 'VICTORY' || gameState.phase === 'GAMEOVER')) {
    const won = gameState.phase === 'VICTORY';
    if (btnAdDoubleChips) btnAdDoubleChips.style.display = 'none';
    if (btnAdRevive) btnAdRevive.style.display = 'none';

    // Sparring pays nothing, so there is never anything new to spend on upgrades here.
    if (btnIntermissionMeta) btnIntermissionMeta.style.display = 'none';
    // On a win the primary button already reads "На Карту Мира" — a second map button beside
    // it was pure duplication. On a loss the primary is "Ещё раз", so this one stays as the
    // way out; the modal has no close control and would otherwise trap the player.
    if (btnIntermissionMap) btnIntermissionMap.style.display = won ? 'none' : '';

    modalTitle.innerText = won ? t('ui.train.win.title') : t('ui.train.lose.title');
    modalDesc.innerHTML = won
      ? `<div style="background: rgba(0,255,102,0.1); border: 1.5px solid var(--neon-green); border-radius: 10px; padding: 14px; margin: 12px 0;">
           <div style="font-size: 1.05rem; color: var(--neon-green); font-weight: 800;">${t('ui.train.win.head')}</div>
         </div>
         <div style="color: var(--text-dim); font-size: 0.9rem;">${t('ui.train.win.body')}</div>`
      : `<div style="background: rgba(255,42,109,0.08); border: 1.5px solid var(--neon-red); border-radius: 10px; padding: 14px; margin: 12px 0;">
           <div style="font-size: 1.05rem; color: var(--neon-red); font-weight: 800;">${t('ui.train.lose.head')}</div>
         </div>
         <div style="color: var(--text-dim); font-size: 0.9rem;">${t('ui.train.lose.body')}</div>`;

    btnModalAction.innerText = won ? t('ui.final.toMap') : t('ui.train.again');
    btnModalAction.onclick = () => {
      modalOverlay.classList.remove('active');
      if (won) {
        gameState.isTrainingBattle = false;
        gameState.screenState = 'WORLD_MAP';
        gameState.notifyUpdate();
      } else {
        gameState.startTrainingBattle();
      }
    };
    shopGrid.innerHTML = '';
    modalOverlay.classList.add('active');
    return;
  }

  if (gameState.phase === 'SHOP') {
    if (btnAdRevive) btnAdRevive.style.display = 'none';
    const nextBossNum = gameState.currentBossIndex + 1;
    const currentLoc = gameState.currentLocationIndex;
    const currentBoss = gameState.currentBossIndex;

    let prevLoc = currentLoc;
    let prevBoss = currentBoss - 1;
    if (prevBoss < 0) {
      prevLoc = Math.max(0, currentLoc - 1);
      prevBoss = 2;
    }
    const baseReward = BOSS_REWARDS[prevLoc]?.[prevBoss] || 35;
    const totalReward = baseReward;
    lastEncounterReward = totalReward;


    modalTitle.innerText = t('ui.win.title', { n: nextBossNum });
    modalDesc.innerHTML = `
      <div style="background: rgba(5, 217, 232, 0.1); border: 1.5px solid var(--neon-cyan); border-radius: 10px; padding: 14px; margin: 12px 0; text-align: center;">
        <div style="font-size: 1.15rem; color: var(--neon-cyan); font-weight: 800; margin-bottom: 6px;">
          ${t('ui.win.reward')} <span style="color: var(--gold); text-shadow: 0 0 10px rgba(255,183,3,0.5);">+${totalReward} $</span>
        </div>
        <div style="font-size: 1rem; color: var(--text-main);">
          ${t('ui.win.balance')} <strong style="color: var(--neon-green); font-size: 1.1rem;">${gameState.player.chips} $</strong>
        </div>
      </div>
      <div style="color: var(--text-dim); font-size: 0.9rem;">${t('ui.win.hint')}</div>
    `;

    // Every win can be doubled. It used to be offered only after clearing a whole
    // location, while every defeat could be doubled — which is what made losing pay.
    if (btnAdDoubleChips) {
      {
        btnAdDoubleChips.style.display = 'inline-block';
        btnAdDoubleChips.disabled = false;
        btnAdDoubleChips.innerText = t('ui.win.double');
        btnAdDoubleChips.onclick = () => {
          platformSDK.showRewardedVideo(() => {
            gameState.player.chips += lastEncounterReward;
            sound.playCoinChime();
            gameState.requestSave();
            btnAdDoubleChips.style.display = 'none';
            if (gameState.onFloatingText) gameState.onFloatingText(t('ui.float.double', { chips: lastEncounterReward }), 'CHIPS', '#ffb703');
            chipsDisplay.innerText = `${gameState.player.chips} $`;
          }, () => reportAdUnavailable('CHIPS'));
        };
      }
    }

    btnModalAction.innerText = t('ui.win.next', { n: nextBossNum });
    btnModalAction.onclick = () => {
      modalOverlay.classList.remove('active');
      showBossIntroModal(gameState.currentLocationIndex, gameState.currentBossIndex);
    };
    shopGrid.innerHTML = '';
    modalOverlay.classList.add('active');
    platformSDK.showInterstitialAd();
  } else if (gameState.phase === 'GAMEOVER') {
    const prevBossNum = gameState.currentBossIndex + 1;
    const consolation = defeatReward(gameState.currentLocationIndex, gameState.currentBossIndex);
    lastEncounterReward = consolation;

    modalTitle.innerText = t('ui.lose.title');
    modalDesc.innerHTML = `
      <div style="background: rgba(255, 42, 109, 0.1); border: 1.5px solid var(--neon-red); border-radius: 10px; padding: 14px; margin: 12px 0; text-align: center;">
        <div style="font-size: 1.15rem; color: var(--neon-red); font-weight: 800; margin-bottom: 6px;">
          ${t('ui.lose.comp')} <span style="color: var(--gold); text-shadow: 0 0 10px rgba(255,183,3,0.5);">+${consolation} $</span>
        </div>
        <div style="font-size: 1rem; color: var(--text-main);">
          ${t('ui.win.balance')} <strong style="color: var(--neon-green); font-size: 1.1rem;">${gameState.player.chips} $</strong>
        </div>
      </div>
      <div style="color: var(--text-dim); font-size: 0.9rem;">${t('ui.lose.hint', { n: prevBossNum })}</div>
    `;

    // No doubling on a defeat. Offering it here while withholding it from ordinary wins is
    // exactly what made throwing a duel the profitable move.
    if (btnAdDoubleChips) btnAdDoubleChips.style.display = 'none';

    if (btnAdRevive) {
      if (!gameState.hasUsedReviveThisBattle) {
        btnAdRevive.style.display = 'inline-block';
        btnAdRevive.onclick = () => {
          platformSDK.showRewardedVideo(() => {
            modalOverlay.classList.remove('active');
            btnAdRevive.style.display = 'none';
            gameState.revivePlayerWith20PercentHp();
          }, () => reportAdUnavailable('PLAYER'));
        };
      } else {
        btnAdRevive.style.display = 'none';
      }
    }

    btnModalAction.innerText = t('ui.lose.retry', { n: prevBossNum });
    shopGrid.innerHTML = '';
    btnModalAction.onclick = () => {
      modalOverlay.classList.remove('active');
      showBossIntroModal(gameState.currentLocationIndex, gameState.currentBossIndex);
    };
    modalOverlay.classList.add('active');
    platformSDK.showInterstitialAd();
  } else if (gameState.screenState === 'VICTORY') {
    if (btnAdDoubleChips) btnAdDoubleChips.style.display = 'none';
    if (btnAdRevive) btnAdRevive.style.display = 'none';
    modalTitle.innerText = t('ui.final.title');
    modalDesc.innerHTML = `
      <div style="background: rgba(0, 255, 102, 0.1); border: 1.5px solid var(--neon-green); border-radius: 10px; padding: 14px; margin: 12px 0; text-align: center;">
        <div style="font-size: 1.2rem; color: var(--neon-green); font-weight: 800; margin-bottom: 6px;">
          ${t('ui.final.jackpot')}
        </div>
        <div style="font-size: 1.1rem; color: var(--text-main);">
          ${t('ui.final.balance')} <strong style="color: var(--gold); font-size: 1.2rem;">${gameState.player.chips} $</strong>
        </div>
      </div>
      <div>${t('ui.final.hint')}</div>
    `;
    btnModalAction.innerText = t('ui.final.toMap');
    shopGrid.innerHTML = '';
    btnModalAction.onclick = () => {
      modalOverlay.classList.remove('active');
      gameState.screenState = 'WORLD_MAP';
      gameState.notifyUpdate();
    };
    modalOverlay.classList.add('active');
  } else {
    if (btnAdDoubleChips) btnAdDoubleChips.style.display = 'none';
    if (btnAdRevive) btnAdRevive.style.display = 'none';
    modalOverlay.classList.remove('active');
  }
}

// Global Ad Buff state variables
let activeAdBuff: { hp: number; armor: number } | undefined = undefined;
let lastEncounterReward = 0;

// Show Boss Dossier Modal
function showBossIntroModal(locIdx: number, bossIdx: number) {
  const loc = LOCATIONS[locIdx];
  const boss = localizedBoss(loc.bosses[bossIdx]);

  const modalBossIntro = document.getElementById('modal-boss-intro')!;
  const bossIntroAvatar = document.getElementById('boss-intro-avatar')!;
  const bossIntroName = document.getElementById('boss-intro-name')!;
  const bossIntroTitle = document.getElementById('boss-intro-title')!;
  const bossIntroDesc = document.getElementById('boss-intro-desc')!;
  const bossIntroAbility = document.getElementById('boss-intro-ability')!;
  const btnBossIntroFight = document.getElementById('btn-boss-intro-fight')!;

  // Ad Buff Button & Scaled Rewards
  const btnBossAdBuff = document.getElementById('btn-boss-ad-buff') as HTMLButtonElement;
  const adBuffVal = (2 + locIdx) * 10; // Loc 1: +20 HP/Shield, Loc 2: +30, ... Loc 5: +60

  if (btnBossAdBuff) {
    btnBossAdBuff.disabled = false;
    btnBossAdBuff.style.opacity = '1';
    btnBossAdBuff.style.cursor = 'pointer';
    btnBossAdBuff.innerText = t('ui.boss.adBuff', { v: adBuffVal });

    btnBossAdBuff.onclick = () => {
      platformSDK.showRewardedVideo(() => {
        activeAdBuff = { hp: adBuffVal, armor: adBuffVal };
        btnBossAdBuff.disabled = true;
        btnBossAdBuff.style.opacity = '0.6';
        btnBossAdBuff.style.cursor = 'default';
        btnBossAdBuff.innerText = t('ui.boss.adBuff.done', { v: adBuffVal });
        sound.playCoinChime();
        if (gameState.onFloatingText) gameState.onFloatingText(t('ui.float.adBuff', { v: adBuffVal }), 'PLAYER', '#00ff66');
      }, () => reportAdUnavailable('PLAYER'));
    };
  }

  if (boss.avatarUrl) {
    bossIntroAvatar.innerHTML = `<img src="${boss.avatarUrl}" class="boss-avatar-img" alt="${boss.name}" />`;
  } else {
    bossIntroAvatar.innerText = boss.avatar;
  }
  bossIntroName.innerText = boss.name;
  bossIntroTitle.innerText = boss.loreTitle || t('ui.boss.title.fallback');
  bossIntroDesc.innerText = boss.loreDesc || t('ui.boss.desc.fallback');
  bossIntroAbility.innerText = boss.specialAbility || t('ui.boss.ability.fallback');

  const btnBossIntroClose = document.getElementById('btn-boss-intro-close')!;
  btnBossIntroClose.onclick = () => {
    modalBossIntro.classList.remove('active');
    activeAdBuff = undefined;
    gameState.screenState = 'WORLD_MAP';
    gameState.notifyUpdate();
  };

  btnBossIntroFight.onclick = () => {
    modalBossIntro.classList.remove('active');
    const buffToApply = activeAdBuff;
    activeAdBuff = undefined;
    gameState.startBossEncounter(locIdx, bossIdx, buffToApply);
  };

  modalBossIntro.classList.add('active');
  tutorial.changeScreen('BOSS_INTRO');
}

// Render World Map with individual Boss Buttons & Statuses
function renderWorldMap() {
  locationsList.innerHTML = '';

  LOCATIONS.forEach((rawLoc, locIdx) => {
    const loc = localizedLocation(rawLoc);
    const isUnlocked = locIdx <= gameState.unlockedLocationIndex;
    const card = document.createElement('div');
    card.className = `location-card ${isUnlocked ? 'unlocked' : 'locked'}`;

    let bossesHTML = '';
    loc.bosses.forEach((rawBoss, bIdx) => {
      const boss = localizedBoss(rawBoss);
      const isCompleted = gameState.completedBosses[locIdx][bIdx];
      const isTarget = isUnlocked && !isCompleted && (bIdx === 0 || gameState.completedBosses[locIdx][bIdx - 1]);
      
      let statusBadge = t('ui.map.locked');
      let btnStyle = 'background: rgba(40,40,60,0.6); color: #888; border: 1px solid #444;';

      if (isCompleted) {
        statusBadge = t('ui.map.completed');
        btnStyle = 'background: rgba(0, 255, 102, 0.15); color: var(--neon-green); border: 1px solid var(--neon-green);';
      } else if (isTarget) {
        statusBadge = t('ui.map.current');
        btnStyle = 'background: linear-gradient(135deg, var(--neon-red), #b0003a); color: #fff; border: none; box-shadow: 0 0 12px rgba(255,42,109,0.5);';
      }

      const avatarHTML = boss.avatarUrl
        ? `<img src="${boss.avatarUrl}" class="world-map-boss-img" alt="${boss.name}" />`
        : boss.avatar;

      // One line per boss: portrait and name, nothing else. The HP figure and the status
      // caption both went — the three states already read off the button's own colour
      // (green beaten, red current, grey locked), and dropping the second line is what
      // lets a location's bosses fit without the card growing.
      //
      // The caption survives as the button's title so the state is still available to a
      // screen reader and on hover, where it costs no room.
      bossesHTML += `
        <button class="btn-boss-select" data-loc="${locIdx}" data-boss="${bIdx}" ${(!isCompleted && !isTarget) ? 'disabled' : ''} title="${statusBadge}" style="font-family: 'Orbitron', sans-serif; padding: 10px 16px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s ease; ${btnStyle}">
          <div style="display: flex; align-items: center; gap: 6px;">${avatarHTML} <strong>${boss.name}</strong></div>
        </button>
      `;
    });

    card.innerHTML = `
      <div class="location-info" style="flex: 1;">
        <div class="location-icon">${loc.icon}</div>
        <div style="flex: 1;">
          <div class="location-title">${loc.name}</div>
          <div style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px; margin-bottom: 12px;">${loc.description}</div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${bossesHTML}
          </div>
        </div>
      </div>
    `;

    // Attach boss button click events
    card.querySelectorAll('.btn-boss-select').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const lIdx = parseInt(target.getAttribute('data-loc') || '0', 10);
        const bIdx = parseInt(target.getAttribute('data-boss') || '0', 10);
        showBossIntroModal(lIdx, bIdx);
      });
    });

    locationsList.appendChild(card);
  });
}

// --- Rewarded ad for chips ------------------------------------------------------------
// The platform cannot rate-limit this: the payout happens in our own onRewarded handler,
// so the window lives in the save and the button reports its own state.
const btnMetaAdChips = document.getElementById('btn-meta-ad-chips') as HTMLButtonElement | null;
let adChipsTicker: ReturnType<typeof setInterval> | null = null;

function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function syncAdChipsButton() {
  if (!btnMetaAdChips) return;

  const { remaining, nextAvailableInMs } = gameState.getAdChipsStatus();
  const available = remaining > 0;

  btnMetaAdChips.disabled = !available;
  btnMetaAdChips.style.opacity = available ? '1' : '0.5';
  btnMetaAdChips.style.cursor = available ? 'pointer' : 'not-allowed';
  btnMetaAdChips.innerText = available
    ? t('ui.meta.ad.available', {
        reward: gameState.getAdChipsReward(),
        left: remaining,
        max: AD_CHIPS_MAX_IN_WINDOW
      })
    : t('ui.meta.ad.exhausted', { time: formatCountdown(nextAvailableInMs) });
}

function startAdChipsTicker() {
  // One ticker, only while the shop is on screen, so the countdown stays live.
  if (adChipsTicker) return;
  adChipsTicker = setInterval(syncAdChipsButton, 1000);
}

function stopAdChipsTicker() {
  if (adChipsTicker) {
    clearInterval(adChipsTicker);
    adChipsTicker = null;
  }
}

btnMetaAdChips?.addEventListener('click', () => {
  if (gameState.getAdChipsStatus().remaining <= 0) return;

  // Lock the button for the duration of the roll so a double tap cannot queue two ads.
  btnMetaAdChips.disabled = true;

  platformSDK.showRewardedVideo(
    () => {
      const amount = gameState.grantAdChips();
      if (amount > 0) {
        sound.playCoinChime();
        if (gameState.onFloatingText) {
          gameState.onFloatingText(t('ui.float.adChips', { chips: amount }), 'CHIPS', '#ffb703');
        }
      }
      gameState.notifyUpdate();
      syncAdChipsButton();
    },
    // No fill, offline, or the player closed it early — the window stays untouched.
    () => {
      syncAdChipsButton();
      reportAdUnavailable('CHIPS');
    }
  );
});

// Render Meta Shop
function renderMetaShop() {
  metaUpgradesGrid.innerHTML = '';

  const hpLvl = Math.round((gameState.metaUpgrades.baseMaxHp - 80) / 20);
  const hpCost = hpUpgradeCost(hpLvl);

  const armorLvl = gameState.metaUpgrades.baseArmor / 10;
  const armorCost = armorUpgradeCost(armorLvl);

  const dmgLvl = gameState.metaUpgrades.baseDamageBonus;
  const dmgCost = damageUpgradeCost(dmgLvl);

  const metaItems = [
    {
      id: 'baseMaxHp',
      name: t('ui.meta.hp.name'),
      icon: '❤️',
      desc: t('ui.meta.hp.desc'),
      val: t('ui.meta.hp.val', { v: gameState.metaUpgrades.baseMaxHp }),
      cost: hpCost
    },
    {
      id: 'baseArmor',
      name: t('ui.meta.armor.name'),
      icon: '🛡️',
      desc: t('ui.meta.armor.desc'),
      val: t('ui.meta.armor.val', { v: gameState.metaUpgrades.baseArmor }),
      cost: armorCost
    },
    {
      id: 'baseDamageBonus',
      name: t('ui.meta.dmg.name'),
      icon: '⚡',
      desc: t('ui.meta.dmg.desc'),
      val: t('ui.meta.dmg.val', { v: gameState.metaUpgrades.baseDamageBonus * 5 }),
      cost: dmgCost
    },
  ];

  metaItems.forEach(item => {
    const canAfford = gameState.player.chips >= item.cost;
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    card.innerHTML = `
      <div style="font-size: 2.2rem;">${item.icon}</div>
      <strong style="color: var(--neon-cyan);">${item.name}</strong>
      <small style="color: var(--text-dim); text-align: center; min-height: 38px;">${item.desc}</small>
      <div style="font-size: 0.85rem; color: var(--neon-purple); font-weight: 700;">${item.val}</div>
      <button class="btn-primary" ${!canAfford ? 'disabled' : ''} style="margin-top: 6px; padding: 8px 16px; font-size: 0.9rem; ${!canAfford ? 'opacity: 0.4; cursor: not-allowed; filter: grayscale(1);' : ''}">
        ${t('ui.meta.buy', { cost: item.cost })}
      </button>
    `;

    card.querySelector('button')?.addEventListener('click', () => {
      gameState.buyMetaUpgrade(item.id as any, item.cost);
    });

    metaUpgradesGrid.appendChild(card);
  });

  // Sparring is a tutorial affordance, not a permanent shop feature: it appears only for
  // the duration of a guided run and disappears with it.
  const btnTraining = document.getElementById('btn-meta-training');
  if (btnTraining) btnTraining.style.display = tutorial.isRunning() ? 'inline-block' : 'none';

  syncAdChipsButton();
  startAdChipsTicker();

  const btnMetaNextBoss = document.getElementById('btn-meta-next-boss');
  if (btnMetaNextBoss) {
    const loc = LOCATIONS[gameState.currentLocationIndex];
    const rawBoss = loc?.bosses[gameState.currentBossIndex];
    const boss = rawBoss ? localizedBoss(rawBoss) : undefined;
    // Named, not declined: "В БОЙ: <имя>" sidesteps the dative that Russian would want
    // around the boss name and that Turkish would want as a suffix on it.
    const bossName = boss ? boss.name : t('ui.meta.bossFallback', { n: gameState.currentBossIndex + 1 });
    btnMetaNextBoss.innerText = t('ui.meta.nextBoss', { boss: bossName });
    btnMetaNextBoss.onclick = () => {
      showBossIntroModal(gameState.currentLocationIndex, gameState.currentBossIndex);
    };
  }
}

// The platform requires the game to fall silent when the page goes to the background —
// a switched tab or a minimised window. Suspension is separate from the player's own mute
// setting, so the sound button still reads the way they left it when they come back.
document.addEventListener('visibilitychange', () => {
  sound.setSuspended(document.visibilityState === 'hidden');
});

// No browser context menu, no selection, no dragging anywhere on the page.
//
// This was bound to #app, on the reasoning that #app is the game. It is not the whole page:
// the letterboxing around it, the margins and the document itself are all outside that node,
// and a right click landing there opened the menu over the game exactly as 1.6.2.7
// describes. The document is the honest target — nothing here is a field a player types in,
// and the markup contains no input, textarea or contenteditable at all.
//
// The stylesheet carries the other half (-webkit-user-select and friends, touch-callout,
// user-drag); these handlers catch what CSS cannot, on engines that fire the event anyway.
for (const type of ['contextmenu', 'selectstart', 'dragstart'] as const) {
  document.addEventListener(type, e => e.preventDefault());
}

// Global Event Listeners & Navigation
function syncSoundButton() {
  const isMuted = sound.isMuted;
  btnSoundToggle.innerText = isMuted ? t('ui.header.sound.off') : t('ui.header.sound.on');
  (btnSoundToggle as HTMLElement).style.color = isMuted ? 'var(--neon-red)' : 'var(--neon-cyan)';
  (btnSoundToggle as HTMLElement).style.borderColor = isMuted ? 'var(--neon-red)' : 'var(--neon-cyan)';
}

btnSoundToggle.addEventListener('click', () => {
  sound.toggleMute();
  syncSoundButton();
  gameState.requestSave();
});

btnStartGame.addEventListener('click', () => {
  gameState.screenState = 'WORLD_MAP';
  gameState.notifyUpdate();
});

btnOpenMetaShop.addEventListener('click', () => {
  gameState.screenState = 'META_SHOP';
  gameState.notifyUpdate();
});

btnMapBackMenu.addEventListener('click', () => {
  gameState.screenState = 'MAIN_MENU';
  gameState.notifyUpdate();
});

btnMapMetaShop.addEventListener('click', () => {
  gameState.screenState = 'META_SHOP';
  gameState.notifyUpdate();
});

btnMetaBackMap.addEventListener('click', () => {
  gameState.screenState = 'WORLD_MAP';
  gameState.notifyUpdate();
});

document.getElementById('btn-intermission-meta')?.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
  gameState.screenState = 'META_SHOP';
  gameState.notifyUpdate();
});

document.getElementById('btn-intermission-map')?.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
  gameState.screenState = 'WORLD_MAP';
  gameState.notifyUpdate();
});

const modalGuide = document.getElementById('modal-guide')!;
const openGuide = () => modalGuide.classList.add('active');
const closeGuide = () => modalGuide.classList.remove('active');

document.getElementById('btn-open-guide-header')?.addEventListener('click', openGuide);
document.getElementById('btn-guide-tutorial')?.addEventListener('click', () => {
  closeGuide();
  startTutorial();
});

document.getElementById('btn-meta-training')?.addEventListener('click', () => {
  gameState.startTrainingBattle();
});

/** Runs the guided tour from the top, starting in the meta shop where step 3 lives. */
function startTutorial() {
  tutorial.init(buildTutorialSteps(gameState));
  gameState.screenState = 'META_SHOP';
  // Start first: renderMetaShop reads tutorial.isRunning() to decide whether the sparring
  // button exists, so the flag has to be up before the shop paints.
  tutorial.start();
  gameState.notifyUpdate();
}

// When the run ends — finished or skipped — repaint so the sparring button goes away.
tutorial.onFinish = () => gameState.notifyUpdate();

document.getElementById('btn-guide-close')?.addEventListener('click', closeGuide);
document.getElementById('btn-guide-start')?.addEventListener('click', closeGuide);

// Dedicated Header Back Button Trigger
const btnHeaderBack = document.getElementById('btn-header-back');
const modalConfirmExit = document.getElementById('modal-confirm-exit')!;

btnHeaderBack?.addEventListener('click', () => {
  if (gameState.screenState === 'BATTLE' && gameState.phase === 'BATTLE') {
    modalConfirmExit.classList.add('active');
  } else if (gameState.screenState === 'META_SHOP') {
    gameState.screenState = 'WORLD_MAP';
    gameState.notifyUpdate();
  } else if (gameState.screenState === 'WORLD_MAP') {
    gameState.screenState = 'MAIN_MENU';
    gameState.notifyUpdate();
  } else {
    gameState.screenState = 'MAIN_MENU';
    gameState.notifyUpdate();
  }
});

document.getElementById('btn-confirm-exit-cancel')?.addEventListener('click', () => {
  modalConfirmExit.classList.remove('active');
});

document.getElementById('btn-confirm-exit-ok')?.addEventListener('click', () => {
  modalConfirmExit.classList.remove('active');
  gameState.screenState = 'WORLD_MAP';
  gameState.notifyUpdate();
});

btnShootDealer.addEventListener('click', () => {
  if (gameState.turn !== 'PLAYER' || gameState.phase !== 'BATTLE') return;

  const rect = btnShootDealer.getBoundingClientRect();
  particles.spawnBurst(rect.left + rect.width / 2, rect.top, '#ff2a6d', 35);
  gameState.shootTarget('DEALER');
});

btnShootSelf.addEventListener('click', () => {
  if (gameState.turn !== 'PLAYER' || gameState.phase !== 'BATTLE') return;

  const rect = btnShootSelf.getBoundingClientRect();
  particles.spawnBurst(rect.left + rect.width / 2, rect.top, '#05d9e8', 35);
  gameState.shootTarget('PLAYER');
});

// Bind GameState Floating Text Callback
gameState.onFloatingText = (text, target, color) => {
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (target === 'DEALER') {
    const rect = dealerAvatar.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + 20;
  } else if (target === 'PLAYER') {
    const rect = playerHpFill.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top - 10;
  } else if (target === 'CHIPS') {
    const rect = chipsDisplay.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + 25;
    chipsDisplay.classList.add('gold-pulse');
    setTimeout(() => chipsDisplay.classList.remove('gold-pulse'), 600);
  }

  particles.spawnFloatingText(text, x, y, color);
};

// Bind GameState Screen Flash Callback
gameState.onScreenFlash = (type: 'live' | 'blank') => {
  const app = document.getElementById('app');
  if (!app) return;
  const className = type === 'live' ? 'flash-vignette-live' : 'flash-vignette-blank';
  app.classList.add('shake');
  app.classList.add(className);

  setTimeout(() => {
    app.classList.remove('shake');
    app.classList.remove(className);
  }, 300);
};

// DOM Elements for Dealer Turn Clarity
const dealerCardShowcase = document.getElementById('dealer-card-showcase')!;
const showcaseCardIcon = document.getElementById('showcase-card-icon')!;
const showcaseCardName = document.getElementById('showcase-card-name')!;
const showcaseCardDesc = document.getElementById('showcase-card-desc')!;

const dealerIntentBanner = document.getElementById('dealer-intent-banner')!;
const dealerIntentText = document.getElementById('dealer-intent-text')!;
const targetReticle = document.getElementById('target-reticle')!;
const playerAvatar = document.getElementById('player-avatar')!;

// Bind GameState Dealer Showcase Card Callback
gameState.onDealerShowcaseCard = (card) => {
  if (showcaseCardIcon) showcaseCardIcon.innerText = card.icon;
  if (showcaseCardName) showcaseCardName.innerText = card.name;
  if (showcaseCardDesc) showcaseCardDesc.innerText = card.description;

  dealerCardShowcase.style.display = 'flex';
};

// Bind GameState Dealer Target Reticle Phase Callback
gameState.onDealerTargeting = (target) => {
  dealerIntentBanner.style.display = 'block';

  const targetAvatarElement = target === 'PLAYER' ? playerAvatar : dealerAvatar;

  if (target === 'PLAYER') {
    dealerIntentText.innerText = t('ui.battle.intent.player');
    dealerIntentBanner.className = 'dealer-intent-banner';
    targetReticle.className = 'target-reticle';
  } else {
    dealerIntentText.innerText = t('ui.battle.intent.self');
    dealerIntentBanner.className = 'dealer-intent-banner self-target';
    targetReticle.className = 'target-reticle self-target';
  }

  // Position reticle centered directly over target avatar
  const avatarRect = targetAvatarElement.getBoundingClientRect();
  const centerSection = document.querySelector('.table-center') as HTMLElement;
  const centerRect = centerSection ? centerSection.getBoundingClientRect() : { left: 0, top: 0 };

  const x = avatarRect.left + avatarRect.width / 2 - centerRect.left;
  const y = avatarRect.top + avatarRect.height / 2 - centerRect.top;

  targetReticle.style.left = `${x}px`;
  targetReticle.style.top = `${y}px`;
  targetReticle.style.display = 'flex';

  sound.playReload();
};

// Clear Dealer Visual FX
gameState.onClearDealerFX = () => {
  dealerCardShowcase.style.display = 'none';
  dealerIntentBanner.style.display = 'none';
  targetReticle.style.display = 'none';
};

// Bind GameState Update Callback
gameState.onUpdateUI = renderUI;

// Numbers the static guide copy quotes. They come from the balance constants rather than
// from the markup so the guide cannot drift away from what the game actually pays.
const STATIC_I18N_PARAMS = {
  chips: BLANK_SELF_SHOT_CHIPS,
  share: Math.round(DEFEAT_SHARE * 100)
};

function applyLang(lang: Lang) {
  setLang(lang);
  applyStaticI18n(STATIC_I18N_PARAMS);
}

/**
 * Resolves the language from the first source that actually named one.
 *
 * A source that named a language we do not ship resolves to English, not Russian. Yandex
 * checks on review that the game follows the locale it was launched in, and a player whose
 * platform is set to German is served far better by English than by a language they cannot
 * read. Russian is the answer only when nobody named anything at all — a standalone build
 * opened with no platform, no ?lang= and no browser preference.
 */
function pickLang(...sources: (string | null | undefined)[]): Lang {
  const spoken = sources.find(s => !!s);
  if (!spoken) return 'ru';
  return normalizeLang(spoken) ?? 'en';
}

/** Shown when an ad cannot be served, so a dead button never just sits there doing nothing. */
function reportAdUnavailable(target: 'PLAYER' | 'CHIPS' = 'CHIPS') {
  if (gameState.onFloatingText) {
    gameState.onFloatingText(t('ui.ad.unavailable'), target, '#ff2a6d');
  }
}

// Boot: bring the platform up first so the save load can reach cloud storage, then paint.
// Nothing here is allowed to keep the player staring at an empty screen, so a failure at
// any step falls through to a fresh game rather than aborting.
/**
 * Hard ceiling on the platform handshake. Nothing here is expected to take this long —
 * the SDK answers in about a second inside a frame — but the boot overlay hides the menu
 * until this function returns, so an init that never settles would leave the game
 * permanently unreachable behind a loading screen. That failure is worse than any it
 * prevents, so the wait is bounded and boot carries on without the platform.
 */
const SDK_INIT_TIMEOUT_MS = 6000;

async function boot() {
  // The static markup is painted but sits behind the boot overlay, so the language is still
  // decided twice: a guess first, so the menu is already correct when the overlay lifts,
  // then the platform's answer. Without the first pass a Turkish player would be shown a
  // Russian menu at the exact moment the game becomes reachable.
  const urlLang = new URLSearchParams(location.search).get('lang');
  const browserLang = typeof navigator !== 'undefined' ? navigator.language : null;
  applyLang(pickLang(urlLang, browserLang));

  try {
    await Promise.race([
      platformSDK.init(),
      new Promise<void>(resolve => setTimeout(resolve, SDK_INIT_TIMEOUT_MS))
    ]);
  } catch (err) {
    console.warn('[Boot] Platform init failed, continuing standalone', err);
  }

  // Then the real answer. The platform's choice always wins — Yandex and VK require the
  // game to follow the locale they launched it in, and Yandex checks it on review. Only
  // when nobody told us (standalone build, local server) does ?lang= apply, which is what
  // makes it possible to proof-read every translation on the real release bundle without
  // touching platform behaviour.
  const platformLang = platformSDK.getLanguage();
  const lang = pickLang(platformLang, urlLang, browserLang);
  if (lang !== getLang()) applyLang(lang);
  console.log('[Boot] Language:', lang, '(platform:', platformLang, 'url:', urlLang, ')');

  try {
    gameState.applySave(await saveManager.load());
  } catch (err) {
    console.warn('[Boot] Save load failed, starting fresh', err);
  }

  syncSoundButton();
  renderUI();

  // The overlay comes down and the platform is told the game is playable — both from the
  // finally block below, so the two happen on every path out of here, not only this one.
  //
  // The order is the requirement, not a preference. 1.19 asks for the signal at the moment
  // the game is ready: every element interactive, no loading screen still up. Signalling
  // first would report a game the player still cannot reach; revealing long before, which
  // is what the bare markup did, let the first tap land before the signal went out. The
  // review flagged the second.
}

// finally, not a plain call: the overlay hides the entire game, so whatever boot() throws,
// it must still come down. A crash that leaves a loading screen up forever is a worse
// outcome than any half-initialised state behind it — and the menu behind the overlay is
// static markup that works on its own.
void boot().catch(err => {
  console.error('[Boot] failed', err);
}).finally(() => {
  const overlay = document.getElementById('boot-overlay');
  if (overlay) {
    overlay.classList.add('done');
    // Removed from the document, not left faded. The class only starts a CSS fade, and a
    // fade that never advances leaves a full-screen panel over the game — which is what a
    // throttled tab does. Taking the node out is the part that is allowed to be load-bearing.
    setTimeout(() => overlay.remove(), 300);
  }
  platformSDK.notifyGameReady();
});
