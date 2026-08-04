import './style.css';
import { GameState } from './game/GameState';
import { ParticleSystem } from './engine/ParticleSystem';
import { LOCATIONS } from './game/BossCatalog';
import { sound } from './engine/AudioSynthesizer';
import { platformSDK } from './engine/PlatformSDK';
import { imagePreloader } from './engine/ImagePreloader';

// Init Platform SDK (Yandex Games / VK Direct Games / Local) & Asset Preloader
platformSDK.init();
imagePreloader.preloadAll();

// Initialize Canvas Particles
const canvas = document.getElementById('fx-canvas') as HTMLCanvasElement;
const particles = new ParticleSystem(canvas);

// Initialize Game State
const gameState = new GameState();

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

// Main UI Render Pipeline
function renderUI() {
  // Screen Switcher
  [screenMainMenu, screenWorldMap, screenMetaShop, screenBattle].forEach(s => s.classList.remove('active'));

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

  // Header Stats
  chipsDisplay.innerText = `${gameState.player.chips} $`;
  stageDisplay.innerText = `Локация ${gameState.currentLocationIndex + 1} | Босс ${gameState.currentBossIndex + 1}`;
}

// Render Battle Table UI
function renderBattleUI() {
  const loc = LOCATIONS[gameState.currentLocationIndex];
  if (loc && document.getElementById('app')) {
    document.getElementById('app')!.style.background = loc.bgGradient;
  }

  const formatHp = (val: number) => {
    const rounded = Math.round(val * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  };

  // Dealer
  const currentLoc = LOCATIONS[gameState.currentLocationIndex];
  const currentBossDef = currentLoc?.bosses[gameState.currentBossIndex];

  if (currentBossDef?.avatarUrl) {
    dealerAvatar.innerHTML = `<img src="${currentBossDef.avatarUrl}" class="boss-avatar-img" alt="${gameState.dealer.name}" />`;
  } else {
    dealerAvatar.innerText = gameState.dealer.avatar;
  }

  dealerName.innerText = gameState.dealer.name;
  const dealerHpPct = Math.max(0, (gameState.dealer.hp / gameState.dealer.maxHp) * 100);
  dealerHpFill.style.width = `${dealerHpPct}%`;
  dealerHpText.innerText = `HP: ${formatHp(gameState.dealer.hp)} / ${formatHp(gameState.dealer.maxHp)}${gameState.dealer.armor > 0 ? ` | 🛡️ БРОНЯ: ${formatHp(gameState.dealer.armor)}` : ''}`;
  dealerDialogue.innerText = `"${gameState.dealer.dialogue}"`;

  // Render Combat Log
  const combatLogEntries = document.getElementById('combat-log-entries');
  if (combatLogEntries) {
    combatLogEntries.innerHTML = gameState.combatLog.map(entry => `<div>${entry}</div>`).join('');
  }

  // Dealer Hand Cards (Static, no bobbing/movement)
  dealerCardsContainer.innerHTML = '';
  gameState.dealer.hand.forEach(() => {
    const card = document.createElement('div');
    card.style.cssText = 'width: 30px; height: 42px; background: linear-gradient(135deg, #1f112b, #ff2a6d); border: 1px solid var(--neon-red); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 0.85rem; box-shadow: 0 0 8px rgba(255, 42, 109, 0.3);';
    card.innerText = '🎴';
    dealerCardsContainer.appendChild(card);
  });

  // Player
  const playerHpPct = Math.max(0, (gameState.player.hp / gameState.player.maxHp) * 100);
  playerHpFill.style.width = `${playerHpPct}%`;
  playerHpText.innerText = `HP: ${formatHp(gameState.player.hp)} / ${formatHp(gameState.player.maxHp)} | 🛡️ БРОНЯ: ${formatHp(gameState.player.armor)}`;

  // Turn
  const isPlayerTurn = gameState.turn === 'PLAYER' && gameState.phase === 'BATTLE';
  turnIndicator.innerText = isPlayerTurn ? 'ВАШ ХОД' : 'ХОД ДИЛЛЕРА';
  turnIndicator.style.color = isPlayerTurn ? 'var(--neon-green)' : 'var(--neon-red)';

  btnShootDealer.disabled = !isPlayerTurn;
  btnShootSelf.disabled = !isPlayerTurn;

  // Multiplier Badge
  if (gameState.damageMultiplier > 1) {
    multiplierBadge.style.display = 'block';
    multiplierBadge.innerText = `МУЛЬТИПЛИКАТОР УРОНА: x${gameState.damageMultiplier}`;
  } else {
    multiplierBadge.style.display = 'none';
  }

  // Circular Revolver Drum Positioning & Rotation
  bulletIndicators.innerHTML = '';
  let liveNum = 0;
  let blankNum = 0;
  const totalBullets = gameState.chamber.bullets.length;
  const radius = 36; // radius in px for 105px drum

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
    cardEl.className = 'item-card';

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
      tooltipDesc.innerText = item.description;

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
      if (isPlayerTurn) {
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

  if (gameState.phase === 'SHOP') {
    if (btnAdRevive) btnAdRevive.style.display = 'none';
    const nextBossNum = gameState.currentBossIndex + 1;
    const currentLoc = gameState.currentLocationIndex;
    const currentBoss = gameState.currentBossIndex;

    // Progressive Option 1 Rewards Matrix: [locIdx][bossIdx]
    const rewardsMatrix = [
      [35, 60, 120],     // Loc 1
      [75, 120, 250],    // Loc 2
      [160, 260, 550],   // Loc 3
      [350, 580, 1200],  // Loc 4
      [800, 1400, 3000]  // Loc 5
    ];
    let prevLoc = currentLoc;
    let prevBoss = currentBoss - 1;
    if (prevBoss < 0) {
      prevLoc = Math.max(0, currentLoc - 1);
      prevBoss = 2;
    }
    const baseReward = rewardsMatrix[prevLoc]?.[prevBoss] || 35;
    const totalReward = Math.round(baseReward * gameState.getChipsMultiplier());
    lastEncounterReward = totalReward;

    // Doubling is available ONLY on Location Boss (when currentBossIndex === 0 after completing boss 3)
    const isLocationBossDefeated = currentBoss === 0;

    modalTitle.innerText = `🎉 ПОБЕДА! ГОТОВНОСТЬ К БОССУ ${nextBossNum}`;
    modalDesc.innerHTML = `
      <div style="background: rgba(5, 217, 232, 0.1); border: 1.5px solid var(--neon-cyan); border-radius: 10px; padding: 14px; margin: 12px 0; text-align: center;">
        <div style="font-size: 1.15rem; color: var(--neon-cyan); font-weight: 800; margin-bottom: 6px;">
          💰 ВЫИГРАШ ЗА ДУЭЛЬ: <span style="color: var(--gold); text-shadow: 0 0 10px rgba(255,183,3,0.5);">+${totalReward} $</span>
        </div>
        <div style="font-size: 1rem; color: var(--text-main);">
          🏦 ТЕКУЩИЙ ОБЩИЙ БАЛАНС: <strong style="color: var(--neon-green); font-size: 1.1rem;">${gameState.player.chips} $</strong>
        </div>
      </div>
      <div style="color: var(--text-dim); font-size: 0.9rem;">Зайдите в Мета-Прокачку характеристик или продолжайте путь!</div>
    `;

    if (btnAdDoubleChips) {
      if (isLocationBossDefeated) {
        btnAdDoubleChips.style.display = 'inline-block';
        btnAdDoubleChips.disabled = false;
        btnAdDoubleChips.innerText = '🏆 📺 Удвоить Джекпот Босса (2x Фишек)!';
        btnAdDoubleChips.onclick = () => {
          platformSDK.showRewardedVideo(() => {
            gameState.player.chips += lastEncounterReward;
            sound.playCoinChime();
            btnAdDoubleChips.style.display = 'none';
            if (gameState.onFloatingText) gameState.onFloatingText(`💰 +${lastEncounterReward}$ (2x ДЖЕКПОТ!)`, 'CHIPS', '#ffb703');
            chipsDisplay.innerText = `${gameState.player.chips} $`;
          });
        };
      } else {
        btnAdDoubleChips.style.display = 'none';
      }
    }

    btnModalAction.innerText = `К Боссу ${nextBossNum} ➔`;
    btnModalAction.onclick = () => {
      modalOverlay.classList.remove('active');
      showBossIntroModal(gameState.currentLocationIndex, gameState.currentBossIndex);
    };
    shopGrid.innerHTML = '';
    modalOverlay.classList.add('active');
    platformSDK.showInterstitialAd();
  } else if (gameState.phase === 'GAMEOVER') {
    const prevBossNum = gameState.currentBossIndex + 1;
    const defeatRewards = [15, 35, 80, 180, 450];
    const baseDefeat = defeatRewards[gameState.currentLocationIndex] || 15;
    const defeatReward = Math.round(baseDefeat * gameState.getChipsMultiplier());
    lastEncounterReward = defeatReward;

    modalTitle.innerText = '💀 ПОРАЖЕНИЕ В ДУЭЛИ';
    modalDesc.innerHTML = `
      <div style="background: rgba(255, 42, 109, 0.1); border: 1.5px solid var(--neon-red); border-radius: 10px; padding: 14px; margin: 12px 0; text-align: center;">
        <div style="font-size: 1.15rem; color: var(--neon-red); font-weight: 800; margin-bottom: 6px;">
          🩹 КОМПЕНСАЦИЯ ЗА РИСК: <span style="color: var(--gold); text-shadow: 0 0 10px rgba(255,183,3,0.5);">+${defeatReward} $</span>
        </div>
        <div style="font-size: 1rem; color: var(--text-main);">
          🏦 ТЕКУЩИЙ ОБЩИЙ БАЛАНС: <strong style="color: var(--neon-green); font-size: 1.1rem;">${gameState.player.chips} $</strong>
        </div>
      </div>
      <div style="color: var(--text-dim); font-size: 0.9rem;">Вы откатились к Боссу ${prevBossNum}. Выберите рекламу или зайдите в Мета-Прокачку!</div>
    `;

    if (btnAdDoubleChips) {
      btnAdDoubleChips.style.display = 'inline-block';
      btnAdDoubleChips.disabled = false;
      btnAdDoubleChips.innerText = '📺 Удвоить компенсацию (2x Фишек)!';
      btnAdDoubleChips.onclick = () => {
        platformSDK.showRewardedVideo(() => {
          gameState.player.chips += lastEncounterReward;
          sound.playCoinChime();
          btnAdDoubleChips.style.display = 'none';
          if (gameState.onFloatingText) gameState.onFloatingText(`💰 +${lastEncounterReward}$ (2x КОМПЕНСАЦИЯ!)`, 'CHIPS', '#ffb703');
          chipsDisplay.innerText = `${gameState.player.chips} $`;
        });
      };
    }

    if (btnAdRevive) {
      if (!gameState.hasUsedReviveThisBattle) {
        btnAdRevive.style.display = 'inline-block';
        btnAdRevive.onclick = () => {
          platformSDK.showRewardedVideo(() => {
            modalOverlay.classList.remove('active');
            btnAdRevive.style.display = 'none';
            gameState.revivePlayerWith20PercentHp();
          });
        };
      } else {
        btnAdRevive.style.display = 'none';
      }
    }

    btnModalAction.innerText = `К Боссу ${prevBossNum} ⚔️`;
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
    modalTitle.innerText = '🏆 ВСЕ 15 БОССОВ ПОВЕРЖЕНЫ!';
    modalDesc.innerHTML = `
      <div style="background: rgba(0, 255, 102, 0.1); border: 1.5px solid var(--neon-green); border-radius: 10px; padding: 14px; margin: 12px 0; text-align: center;">
        <div style="font-size: 1.2rem; color: var(--neon-green); font-weight: 800; margin-bottom: 6px;">
          👑 ФИНАЛЬНЫЙ ДЖЕКПОТ ЗАБРАН!
        </div>
        <div style="font-size: 1.1rem; color: var(--text-main);">
          🏦 ИТОГОВЫЙ БАЛАНС ИМПЕРИИ: <strong style="color: var(--gold); font-size: 1.2rem;">${gameState.player.chips} $</strong>
        </div>
      </div>
      <div>Вы обыграли все 5 локаций и стали легендой подполья!</div>
    `;
    btnModalAction.innerText = 'На Карту Мира 🌍';
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
  const boss = loc.bosses[bossIdx];

  const modalBossIntro = document.getElementById('modal-boss-intro')!;
  const bossIntroAvatar = document.getElementById('boss-intro-avatar')!;
  const bossIntroName = document.getElementById('boss-intro-name')!;
  const bossIntroTitle = document.getElementById('boss-intro-title')!;
  const bossIntroDesc = document.getElementById('boss-intro-desc')!;
  const bossIntroAbility = document.getElementById('boss-intro-ability')!;
  const btnBossIntroFight = document.getElementById('btn-boss-intro-fight')!;

  // Ad Buff Button & Scaled Rewards
  const btnBossAdBuff = document.getElementById('btn-boss-ad-buff') as HTMLButtonElement;
  const adBuffLabel = document.getElementById('ad-buff-label');
  const adBuffVal = 2 + locIdx; // Loc 1: +2 HP/Shield, Loc 2: +3, Loc 3: +4, Loc 4: +5, Loc 5: +6

  if (adBuffLabel) {
    adBuffLabel.innerText = `+${adBuffVal} HP и +${adBuffVal} Щита`;
  }

  if (btnBossAdBuff) {
    btnBossAdBuff.disabled = false;
    btnBossAdBuff.style.opacity = '1';
    btnBossAdBuff.style.cursor = 'pointer';
    btnBossAdBuff.innerHTML = `📺 Смотреть рекламу: <span id="ad-buff-label">+${adBuffVal} HP и +${adBuffVal} Щита</span>`;

    btnBossAdBuff.onclick = () => {
      platformSDK.showRewardedVideo(() => {
        activeAdBuff = { hp: adBuffVal, armor: adBuffVal };
        btnBossAdBuff.disabled = true;
        btnBossAdBuff.style.opacity = '0.6';
        btnBossAdBuff.style.cursor = 'default';
        btnBossAdBuff.innerHTML = `✅ БАФФ АКТИВИРОВАН! (+${adBuffVal} HP / +${adBuffVal} Щит)`;
        sound.playCoinChime();
        if (gameState.onFloatingText) gameState.onFloatingText(`📺 РЕКЛАМА: +${adBuffVal} HP И +${adBuffVal} ЩИТА!`, 'PLAYER', '#00ff66');
      });
    };
  }

  if (boss.avatarUrl) {
    bossIntroAvatar.innerHTML = `<img src="${boss.avatarUrl}" class="boss-avatar-img" alt="${boss.name}" />`;
  } else {
    bossIntroAvatar.innerText = boss.avatar;
  }
  bossIntroName.innerText = boss.name;
  bossIntroTitle.innerText = boss.loreTitle || '«Босс Сезона»';
  bossIntroDesc.innerText = boss.loreDesc || 'Опытный противник подпольного казино.';
  bossIntroAbility.innerText = boss.specialAbility || 'Агрессивный стиль игры и тактический просчет.';

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
}

// Render World Map with individual Boss Buttons & Statuses
function renderWorldMap() {
  locationsList.innerHTML = '';

  LOCATIONS.forEach((loc, locIdx) => {
    const isUnlocked = locIdx <= gameState.unlockedLocationIndex;
    const card = document.createElement('div');
    card.className = `location-card ${isUnlocked ? 'unlocked' : 'locked'}`;

    let bossesHTML = '';
    loc.bosses.forEach((boss, bIdx) => {
      const isCompleted = gameState.completedBosses[locIdx][bIdx];
      const isTarget = isUnlocked && !isCompleted && (bIdx === 0 || gameState.completedBosses[locIdx][bIdx - 1]);
      
      let statusBadge = '🔒 ЗАКРЫТ';
      let btnStyle = 'background: rgba(40,40,60,0.6); color: #888; border: 1px solid #444;';
      
      if (isCompleted) {
        statusBadge = '✅ ПОБЕЖДЕН (Фарм)';
        btnStyle = 'background: rgba(0, 255, 102, 0.15); color: var(--neon-green); border: 1px solid var(--neon-green);';
      } else if (isTarget) {
        statusBadge = '⚔️ ТЕКУЩИЙ ВЫЗОВ';
        btnStyle = 'background: linear-gradient(135deg, var(--neon-red), #b0003a); color: #fff; border: none; box-shadow: 0 0 12px rgba(255,42,109,0.5);';
      }

      const avatarHTML = boss.avatarUrl
        ? `<img src="${boss.avatarUrl}" class="world-map-boss-img" alt="${boss.name}" />`
        : boss.avatar;

      bossesHTML += `
        <button class="btn-boss-select" data-loc="${locIdx}" data-boss="${bIdx}" ${(!isCompleted && !isTarget) ? 'disabled' : ''} style="font-family: 'Orbitron', sans-serif; padding: 10px 16px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s ease; ${btnStyle}">
          <div style="display: flex; align-items: center; gap: 6px;">${avatarHTML} <strong>${boss.name}</strong> (HP: ${boss.hp})</div>
          <div style="font-size: 0.7rem; font-family: 'Fira Code', monospace; margin-top: 3px;">${statusBadge}</div>
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

// Render Meta Shop
function renderMetaShop() {
  metaUpgradesGrid.innerHTML = '';

  const hpLvl = Math.round((gameState.metaUpgrades.baseMaxHp - 8) / 2);
  const hpCost = 150 + hpLvl * 75;

  const armorLvl = gameState.metaUpgrades.baseArmor;
  const armorCost = 200 + armorLvl * 100;

  const dmgLvl = gameState.metaUpgrades.baseDamageBonus;
  const dmgCost = 250 + dmgLvl * 125;

  const chipsLvl = gameState.metaUpgrades.capitalBonus;
  const chipsCost = 100 + chipsLvl * 25;

  const metaItems = [
    {
      id: 'baseMaxHp',
      name: 'Базовое Здоровье (+2 HP)',
      icon: '❤️',
      desc: 'Постоянно увеличивает максимум HP на +2 единицы.',
      val: `${gameState.metaUpgrades.baseMaxHp} Max HP`,
      cost: hpCost
    },
    {
      id: 'baseArmor',
      name: 'Кибер-Броня (+1 Shield)',
      icon: '🛡️',
      desc: 'Постоянный щит на каждый бой, поглощающий урон.',
      val: `${gameState.metaUpgrades.baseArmor} Щит`,
      cost: armorCost
    },
    {
      id: 'baseDamageBonus',
      name: 'Усилитель Патронов (+0.5 Урон)',
      icon: '⚡',
      desc: 'Увеличивает базовый урон всех боевых патронов.',
      val: `+${gameState.metaUpgrades.baseDamageBonus * 0.5} Урона`,
      cost: dmgCost
    },
    {
      id: 'capitalBonus',
      name: 'Бонус Капитала (+0.1%)',
      icon: '💰',
      desc: 'Увеличивает получаемые фишки за победы, поражения и адресные бонусы на +0.1% за ур.',
      val: `Бонус награды: +${(gameState.metaUpgrades.capitalBonus * 0.1).toFixed(1)}%`,
      cost: chipsCost
    }
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
        Купить: ${item.cost} $
      </button>
    `;

    card.querySelector('button')?.addEventListener('click', () => {
      gameState.buyMetaUpgrade(item.id as any, item.cost);
    });

    metaUpgradesGrid.appendChild(card);
  });

  const btnMetaAdChips = document.getElementById('btn-meta-ad-chips');
  if (btnMetaAdChips) {
    btnMetaAdChips.onclick = () => {
      gameState.player.chips += 150;
      sound.playCoinChime();
      if (gameState.onFloatingText) gameState.onFloatingText('+150 $ (РЕКЛАМА 📺)', 'CHIPS', '#ffb703');
      gameState.notifyUpdate();
    };
  }

  const btnMetaNextBoss = document.getElementById('btn-meta-next-boss');
  if (btnMetaNextBoss) {
    const loc = LOCATIONS[gameState.currentLocationIndex];
    const boss = loc?.bosses[gameState.currentBossIndex];
    const bossName = boss ? boss.name : `Боссу ${gameState.currentBossIndex + 1}`;
    btnMetaNextBoss.innerText = `⚔️ В БОЙ (К ${bossName}) ➔`;
    btnMetaNextBoss.onclick = () => {
      showBossIntroModal(gameState.currentLocationIndex, gameState.currentBossIndex);
    };
  }
}

// Global Event Listeners & Navigation
btnSoundToggle.addEventListener('click', () => {
  const isMuted = sound.toggleMute();
  btnSoundToggle.innerText = isMuted ? '🔇 ВЫКЛ' : '🔊 ЗВУК';
  (btnSoundToggle as HTMLElement).style.color = isMuted ? 'var(--neon-red)' : 'var(--neon-cyan)';
  (btnSoundToggle as HTMLElement).style.borderColor = isMuted ? 'var(--neon-red)' : 'var(--neon-cyan)';
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
document.getElementById('btn-open-guide-menu')?.addEventListener('click', openGuide);
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
    dealerIntentText.innerText = '🎯 ДИЛЛЕР ЦЕЛИТСЯ В ВАС...';
    dealerIntentBanner.className = 'dealer-intent-banner';
    targetReticle.className = 'target-reticle';
  } else {
    dealerIntentText.innerText = '🛡️ ДИЛЛЕР ЦЕЛИТСЯ В СЕБЯ...';
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

// Initial Render
renderUI();
