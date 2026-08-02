import type { BulletType, ChamberState, DealerStats, GamePhase, GameTurn, ItemCard, MetaUpgrades, PlayerStats, ScreenState } from './Types';
import { getRandomItems } from './ItemCatalog';
import { LOCATIONS } from './BossCatalog';
import { DealerAI } from './DealerAI';
import { sound } from '../engine/AudioSynthesizer';

export class GameState {
  screenState: ScreenState = 'MAIN_MENU';
  phase: GamePhase = 'BATTLE';
  turn: GameTurn = 'PLAYER';

  // Location & Boss Progression (5 Locations x 3 Bosses = 15 Bosses)
  currentLocationIndex = 0;
  currentBossIndex = 0;
  unlockedLocationIndex = 0;

  // Completed bosses matrix: 5 locations x 3 bosses
  completedBosses: boolean[][] = Array(5).fill(false).map(() => [false, false, false]);

  metaUpgrades: MetaUpgrades = {
    baseMaxHp: 8,
    baseArmor: 0,
    baseDamageBonus: 0,
    capitalBonus: 0
  };

  getChipsMultiplier(): number {
    return 1 + (this.metaUpgrades.capitalBonus * 0.1);
  }

  getEnemyBaseDamage(): number {
    const loc = this.currentLocationIndex; // 0 to 4
    const isBoss = this.currentBossIndex === 2; // 3rd boss (index 2) of location

    let baseDmg = 1.0;
    if (isBoss) {
      // Boss Base Damage: 1.0 (Loc 1) -> 2.5 (Loc 5)
      baseDmg = 1.0 + (loc * 0.375);
    } else {
      // Regular Minions Base Damage: 1.0 (Loc 1) -> 1.5 (Loc 5)
      baseDmg = 1.0 + (loc * 0.125);
    }

    // 1.5x damage boost for bosses and minions from Location 2+
    if (loc >= 1) {
      baseDmg *= 1.5;
    }

    return baseDmg;
  }

  player: PlayerStats = {
    hp: 8,
    maxHp: 8,
    hand: [],
    chips: 100,
    relics: [],
    armor: 0
  };

  dealer: DealerStats = {
    name: 'ИИ-Диллер "Вектор"',
    avatar: '🤖',
    hp: 4,
    maxHp: 4,
    armor: 0,
    hand: [],
    dialogue: DealerAI.getDialogue('START')
  };

  chamber: ChamberState = {
    bullets: [],
    currentIndex: 0,
    knownBullets: []
  };

  damageMultiplier = 1;
  mirrorShieldActive = { player: false, dealer: false };
  isShooting = false;
  combatLog: string[] = ['• Дуэль началась. Барабан заряжен!'];

  private dealerTurnTimeout: any = null;
  private isDealerProcessing = false;

  onUpdateUI?: () => void;
  onFloatingText?: (text: string, target: 'DEALER' | 'PLAYER' | 'CHIPS', color: string) => void;
  onScreenFlash?: (type: 'live' | 'blank') => void;

  addLog(entry: string) {
    this.combatLog.unshift(`• ${entry}`);
    if (this.combatLog.length > 4) {
      this.combatLog.pop();
    }
  }

  scheduleDealerTurn(delayMs: number = 300) {
    if (this.dealerTurnTimeout) {
      clearTimeout(this.dealerTurnTimeout);
      this.dealerTurnTimeout = null;
    }
    this.dealerTurnTimeout = setTimeout(() => {
      this.dealerTurnTimeout = null;
      this.processDealerTurn();
    }, delayMs);
  }

  constructor() {
    this.player.chips = 100;
  }

  startBossEncounter(locIdx: number, bossIdx: number, adBuff?: { hp: number; armor: number }) {
    this.currentLocationIndex = locIdx;
    this.currentBossIndex = bossIdx;
    this.hasUsedReviveThisBattle = false;

    const location = LOCATIONS[locIdx];
    const bossDef = location.bosses[bossIdx];

    // Apply Meta Upgrades & Ad Buffs
    const extraHp = adBuff ? adBuff.hp : 0;
    const extraArmor = adBuff ? adBuff.armor : 0;

    this.player.maxHp = this.metaUpgrades.baseMaxHp + extraHp;
    this.player.hp = this.player.maxHp;
    this.player.armor = this.metaUpgrades.baseArmor + extraArmor;

    // Boss Stats
    this.dealer.name = bossDef.name;
    this.dealer.avatar = bossDef.avatar;
    this.dealer.maxHp = bossDef.hp;
    this.dealer.hp = bossDef.hp;
    this.dealer.armor = bossDef.armor || 0;

    // Hands
    this.player.hand = getRandomItems(3);
    this.dealer.hand = getRandomItems(3);

    this.reloadChamber();
    this.phase = 'BATTLE';
    this.turn = 'PLAYER';
    this.screenState = 'BATTLE';
    this.dealer.dialogue = bossDef.dialogueSet[0] || DealerAI.getDialogue('START');
    this.notifyUpdate();
  }

  reloadChamber() {
    const count = 4 + Math.floor(Math.random() * 3); // 4 to 6 bullets
    const liveCount = Math.max(1, Math.floor(count / 2) + (Math.random() > 0.5 ? 1 : 0));
    const blankCount = count - liveCount;

    const bullets: BulletType[] = [
      ...Array(liveCount).fill('LIVE'),
      ...Array(blankCount).fill('BLANK')
    ];

    // Shuffle
    for (let i = bullets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bullets[i], bullets[j]] = [bullets[j], bullets[i]];
    }

    this.chamber = {
      bullets,
      currentIndex: 0,
      knownBullets: Array(count).fill(null)
    };

    this.damageMultiplier = 1;
    this.mirrorShieldActive = { player: false, dealer: false };
    sound.playClick();
  }

  shootTarget(target: 'DEALER' | 'PLAYER') {
    if (this.phase !== 'BATTLE') return;

    if (this.chamber.currentIndex >= this.chamber.bullets.length) {
      this.reloadChamber();
    }

    const currentBullet = this.chamber.bullets[this.chamber.currentIndex];
    const isLive = currentBullet === 'LIVE';

    this.chamber.currentIndex++;
    const isChamberEmpty = this.chamber.currentIndex >= this.chamber.bullets.length;

    const formatHp = (val: number) => {
      const rounded = Math.round(val * 10) / 10;
      return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
    };

    if (isLive) {
      if (this.onScreenFlash) this.onScreenFlash('live');
      sound.playLiveShot();
      const baseDmg = this.turn === 'PLAYER'
        ? (1 + this.metaUpgrades.baseDamageBonus * 0.5)
        : this.getEnemyBaseDamage();
      const dmg = baseDmg * this.damageMultiplier;
      this.damageMultiplier = 1;

      if (target === 'DEALER') {
        if (this.mirrorShieldActive.dealer) {
          this.applyDamageToPlayer(dmg);
          this.mirrorShieldActive.dealer = false;
          if (this.onFloatingText) this.onFloatingText(`-${formatHp(dmg)} HP (ОТРАЖЕНО!)`, 'PLAYER', '#ff2a6d');
          this.addLog(`${this.turn === 'PLAYER' ? 'Вы выстрелили' : 'Босс выстрелил'} в Диллера (🔴 Отражено -${formatHp(dmg)} HP вам)`);
        } else {
          this.applyDamageToDealer(dmg);
          this.addLog(`${this.turn === 'PLAYER' ? 'Вы выстрелили' : 'Босс выстрелил'} в Диллера (🔴 Боевой -${formatHp(dmg)} HP)`);
        }
        this.dealer.dialogue = DealerAI.getDialogue('PLAYER_SHOOT_DEALER_LIVE');
      } else {
        // Shot self with LIVE - cap self-damage at 3 max so no oneshots!
        const selfDmg = Math.min(3, dmg);
        if (this.mirrorShieldActive.player) {
          this.applyDamageToDealer(selfDmg);
          this.mirrorShieldActive.player = false;
          this.addLog(`${this.turn === 'PLAYER' ? 'Вы выстрелили' : 'Босс выстрелил'} в себя (🔴 Отражено -${formatHp(selfDmg)} HP Боссу)`);
        } else {
          this.applyDamageToPlayer(selfDmg);
          if (this.onFloatingText) this.onFloatingText(`🔴 БОЕВОЙ В СЕБЯ! -${formatHp(selfDmg)} HP`, 'PLAYER', '#ff2a6d');
          this.addLog(`${this.turn === 'PLAYER' ? 'Вы выстрелили' : 'Босс выстрелил'} в себя (🔴 Боевой -${formatHp(selfDmg)} HP)`);
        }
        this.dealer.dialogue = `💥 БОЕВОЙ В СЕБЯ! Урон -${formatHp(selfDmg)} HP. Ход перешел к Диллеру!`;
      }
    } else {
      // BLANK round
      if (this.onScreenFlash) this.onScreenFlash('blank');
      sound.playBlankClick();
      this.damageMultiplier = 1;

      if (target === 'DEALER') {
        if (this.onFloatingText) this.onFloatingText('🔵 ХОЛОСТОЙ! (0 УРОНА)', 'DEALER', '#05d9e8');
        this.dealer.dialogue = `💨 ЩЕЛЧОК! Холостой патрон (0 урона). Ход передается Диллеру!`;
        this.addLog(`${this.turn === 'PLAYER' ? 'Вы выстрелили' : 'Босс выстрелил'} в Диллера (🔵 Холостой 0 HP)`);
      } else {
        if (this.turn === 'PLAYER') {
          const bonusChips = Math.round(25 * this.getChipsMultiplier());
          this.player.chips += bonusChips;
          sound.playCoinChime();
          if (this.onFloatingText) {
            this.onFloatingText(`🔵 ХОЛОСТОЙ В СЕБЯ! (+${bonusChips}$)`, 'PLAYER', '#00ff66');
            this.onFloatingText(`+${bonusChips} $ 💰`, 'CHIPS', '#ffb703');
          }
          this.dealer.dialogue = `🔥 АДРЕНАЛИНОВЫЙ БОНУС! Холостой по себе: +${bonusChips}$ и Повторный Ход!`;
          this.addLog(`Вы выстрелили в себя (🔵 Холостой +${bonusChips}$)`);
        } else {
          if (this.onFloatingText) this.onFloatingText('🔵 ХОЛОСТОЙ В СЕБЯ (0 УРОНА)', 'DEALER', '#05d9e8');
          this.dealer.dialogue = DealerAI.getDialogue('PLAYER_SHOOT_SELF_BLANK');
          this.addLog(`Босс выстрелил в себя (🔵 Холостой 0 HP)`);
        }
      }
    }

    // Check Win / Loss
    if (this.dealer.hp <= 0) {
      this.handleBossVictory();
      return;
    }

    if (this.player.hp <= 0) {
      this.handlePlayerDefeatRewind();
      return;
    }

    // Reload if chamber emptied
    if (isChamberEmpty) {
      this.reloadChamber();
      this.player.hand.push(...getRandomItems(2));
      this.dealer.hand.push(...getRandomItems(2));
      sound.playCardSlide();
      this.dealer.dialogue = '📦 БАРАБАН ОПУСТЕЛ! Казино выдает игрокам по 2 новые карты предметов!';
    }

    // Turn switching rules
    if (this.turn === 'PLAYER') {
      if (target === 'PLAYER' && !isLive) {
        // Player shot self with blank -> Keep Player turn
        this.turn = 'PLAYER';
      } else {
        // Switch to Dealer turn
        this.turn = 'DEALER';
        this.scheduleDealerTurn(400);
      }
    } else {
      // Dealer's turn
      if (target === 'DEALER' && !isLive) {
        // Dealer shot self with blank -> Keep Dealer turn & schedule next decision comfortably!
        this.turn = 'DEALER';
        this.dealer.dialogue = `💨 Босс выстрелил в себя: ХОЛОСТОЙ! (0 урона). Босс берет повторный ход...`;
        this.scheduleDealerTurn(800);
      } else {
        // Dealer shot player OR shot self with live -> Switch to Player turn
        this.turn = 'PLAYER';
        if (this.onFloatingText) this.onFloatingText('⚡ ВАШ ХОД!', 'PLAYER', '#00ff66');
      }
    }

    this.notifyUpdate();
  }

  applyDamageToPlayer(amount: number) {
    let remainingDmg = amount;
    const formatHp = (val: number) => {
      const rounded = Math.round(val * 10) / 10;
      return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
    };

    if (this.player.armor > 0) {
      const absorbed = Math.min(this.player.armor, remainingDmg);
      this.player.armor -= absorbed;
      remainingDmg -= absorbed;
      if (this.onFloatingText) this.onFloatingText(`🛡️ БРОНЯ ПОГЛОТИЛА -${formatHp(absorbed)} HP!`, 'PLAYER', '#05d9e8');
    }
    if (remainingDmg > 0) {
      this.player.hp = Math.max(0, this.player.hp - remainingDmg);
      if (this.onFloatingText) this.onFloatingText(`🔴 -${formatHp(remainingDmg)} HP!`, 'PLAYER', '#ff2a6d');
    }
  }

  applyDamageToDealer(amount: number) {
    let remainingDmg = amount;
    const formatHp = (val: number) => {
      const rounded = Math.round(val * 10) / 10;
      return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
    };

    if (this.dealer.armor > 0) {
      const absorbed = Math.min(this.dealer.armor, remainingDmg);
      this.dealer.armor -= absorbed;
      remainingDmg -= absorbed;
      if (this.onFloatingText) this.onFloatingText(`🛡️ БРОНЯ ВРАГА -${formatHp(absorbed)}!`, 'DEALER', '#05d9e8');
    }
    if (remainingDmg > 0) {
      this.dealer.hp = Math.max(0, this.dealer.hp - remainingDmg);
      if (this.onFloatingText) this.onFloatingText(`🔴 -${formatHp(remainingDmg)} HP!`, 'DEALER', '#ff2a6d');
    }
  }

  useItem(itemIndex: number, user: 'PLAYER' | 'DEALER') {
    const hand = user === 'PLAYER' ? this.player.hand : this.dealer.hand;
    if (itemIndex < 0 || itemIndex >= hand.length) return;

    const item = hand[itemIndex];
    hand.splice(itemIndex, 1);
    sound.playItemPowerup();
    this.addLog(`${user === 'PLAYER' ? 'Вы применили' : 'Босс применил'} карту «${item.name}»`);

    const currIdx = this.chamber.currentIndex;

    switch (item.id) {
      case 'MAGNIFIER':
        if (currIdx < this.chamber.bullets.length) {
          const bullet = this.chamber.bullets[currIdx];
          this.chamber.knownBullets[currIdx] = bullet;
          if (user === 'PLAYER') {
            this.dealer.dialogue = `Вы посмотрели в лупу: текущий патрон — ${bullet === 'LIVE' ? 'БОЕВОЙ 🔴' : 'ХОЛОСТОЙ 🔵'}.`;
          } else {
            this.dealer.dialogue = `🔍 Босс посмотрел в лупу и узнал секретный патрон!`;
          }
        }
        break;

      case 'SAW':
        this.damageMultiplier = 2;
        this.dealer.dialogue = `${user === 'PLAYER' ? 'Вы подпилили' : 'Босс подпилил'} ствол! Урон следующего выстрела х2!`;
        break;

      case 'ENERGY_DRINK':
        if (currIdx < this.chamber.bullets.length) {
          const ejected = this.chamber.bullets[currIdx];
          this.chamber.currentIndex++;
          this.dealer.dialogue = `${user === 'PLAYER' ? 'Вы выбросили' : 'Босс выбросил'} патрон (${ejected === 'LIVE' ? 'БОЕВОЙ 🔴' : 'ХОЛОСТОЙ 🔵'}).`;
          if (this.chamber.currentIndex >= this.chamber.bullets.length) {
            this.reloadChamber();
          }
        }
        break;

      case 'CIGARETTE':
        if (user === 'PLAYER') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        } else {
          this.dealer.hp = Math.min(this.dealer.maxHp, this.dealer.hp + 1);
        }
        this.dealer.dialogue = `${user === 'PLAYER' ? 'Вы выкурили' : 'Босс выкурил'} сигарету (+1 HP).`;
        break;

      case 'HACK_CHIP':
        if (currIdx < this.chamber.bullets.length) {
          const orig = this.chamber.bullets[currIdx];
          const flipped = orig === 'LIVE' ? 'BLANK' : 'LIVE';
          this.chamber.bullets[currIdx] = flipped;
          this.chamber.knownBullets[currIdx] = flipped;
          this.dealer.dialogue = `Хак-чип инвертировал патрон на ${flipped === 'LIVE' ? 'БОЕВОЙ 🔴' : 'ХОЛОСТОЙ 🔵'}!`;
        }
        break;

      case 'MIRROR_SHIELD':
        if (user === 'PLAYER') this.mirrorShieldActive.player = true;
        else this.mirrorShieldActive.dealer = true;
        this.dealer.dialogue = `${user === 'PLAYER' ? 'Вы активировали' : 'Босс активировал'} Зеркальный Щит!`;
        break;

      case 'CURSED_COIN':
        this.turn = this.turn === 'PLAYER' ? 'DEALER' : 'PLAYER';
        this.dealer.dialogue = `Проклятая монета передала ход!`;
        if (this.turn === 'DEALER') {
          this.scheduleDealerTurn(1000);
        }
        break;

      case 'OVERDRIVE':
        this.damageMultiplier = 3;
        this.dealer.dialogue = `Включен ОВЕРДРАЙВ (x3 урон)!`;
        break;

      case 'MAGNET':
        if (user === 'PLAYER' && this.dealer.hand.length > 0) {
          const stolenIdx = Math.floor(Math.random() * this.dealer.hand.length);
          const stolenCard = this.dealer.hand.splice(stolenIdx, 1)[0];
          this.player.hand.push(stolenCard);
          this.dealer.dialogue = `🧲 Магнит притянул карту "${stolenCard.name}" из руки босса!`;
        }
        break;

      case 'XRAY':
        for (let i = 0; i < this.chamber.bullets.length; i++) {
          this.chamber.knownBullets[i] = this.chamber.bullets[i];
        }
        this.dealer.dialogue = `🩺 Рентген-Сканер раскрыл ВСЕ патроны в барабане!`;
        break;

      case 'OVERDRIVE_2':
        this.damageMultiplier = 4;
        this.dealer.dialogue = `⚡ ОВЕРДРАЙВ 2.0 (х4 урон) активирован!`;
        break;

      case 'NULLIFIER':
        this.damageMultiplier = 1;
        if (user === 'PLAYER' && this.dealer.hand.length > 0) {
          this.dealer.hand.pop();
        }
        this.dealer.dialogue = `🚫 Нуллификатор сбросил умножители и удалил карту босса!`;
        break;
    }

    this.notifyUpdate();
  }

  processDealerTurn() {
    if (this.phase !== 'BATTLE' || this.turn !== 'DEALER') {
      this.isDealerProcessing = false;
      return;
    }

    if (this.isDealerProcessing) return;
    this.isDealerProcessing = true;

    try {
      const decision = DealerAI.decideTurn(
        this.chamber,
        this.dealer.hand,
        this.dealer.hp,
        this.player.hp,
        this.dealer.maxHp
      );

      if (
        decision.action === 'USE_ITEM' &&
        decision.itemIndex !== undefined &&
        decision.itemIndex >= 0 &&
        decision.itemIndex < this.dealer.hand.length
      ) {
        this.useItem(decision.itemIndex, 'DEALER');
        this.isDealerProcessing = false;
        this.scheduleDealerTurn(400);
      } else if (decision.action === 'SHOOT_PLAYER') {
        this.isDealerProcessing = false;
        this.shootTarget('PLAYER');
      } else {
        this.isDealerProcessing = false;
        this.shootTarget('DEALER');
      }
    } catch (err) {
      console.error('Dealer AI turn error:', err);
      this.isDealerProcessing = false;
      this.shootTarget('PLAYER');
    }
  }

  handleBossVictory() {
    sound.playCoinChime();
    const currentLoc = this.currentLocationIndex;
    const currentBoss = this.currentBossIndex;

    // Mark current boss as completed!
    this.completedBosses[currentLoc][currentBoss] = true;

    // Reward Chips (with Capital Bonus Multiplier)
    const baseReward = 100 + (currentLoc + 1) * 50 + (currentBoss + 1) * 25;
    const reward = Math.round(baseReward * this.getChipsMultiplier());
    this.player.chips += reward;

    if (currentBoss < 2) {
      // Advance to next boss in same location!
      this.currentBossIndex = currentBoss + 1;
      this.phase = 'SHOP';
      this.dealer.dialogue = `🎉 ПОБЕДА! Босс ${currentBoss + 1} повержен! Заработано ${reward}$. Подготовьтесь к Боссу ${this.currentBossIndex + 1}.`;
    } else {
      // Completed Location 3/3 Bosses!
      if (currentLoc < 4) {
        this.unlockedLocationIndex = Math.max(this.unlockedLocationIndex, currentLoc + 1);
        this.currentLocationIndex = currentLoc + 1;
        this.currentBossIndex = 0;
        this.phase = 'SHOP';
        this.dealer.dialogue = `🏆 ЛОКАЦИЯ ${currentLoc + 1} ПОЛНОСТЬЮ ПРОЙДЕНА! Открыта Локация ${this.currentLocationIndex + 1}!`;
      } else {
        this.screenState = 'VICTORY';
      }
    }

    this.notifyUpdate();
  }

  handlePlayerDefeatRewind() {
    sound.playBlankClick();

    // Consolation reward on defeat (with Capital Bonus Multiplier)
    const defeatReward = Math.round(70 * this.getChipsMultiplier());
    this.player.chips += defeatReward;

    this.phase = 'GAMEOVER';
    this.dealer.dialogue = `💀 ПОРАЖЕНИЕ! Вам выплачена компенсация +${defeatReward}$. Зайдите в Мета-Прокачку или на Карту Мира!`;
    this.notifyUpdate();
  }

  acceptDefeatAndRewind() {
    if (this.phase === 'GAMEOVER') {
      // Rewind back 1 boss in current location
      const prevBossIndex = Math.max(0, this.currentBossIndex - 1);
      this.currentBossIndex = prevBossIndex;
      this.phase = 'SHOP';
    }
  }

  hasUsedReviveThisBattle = false;

  revivePlayerWith20PercentHp() {
    this.hasUsedReviveThisBattle = true;
    const restoredHp = Math.max(2, Math.ceil(this.player.maxHp * 0.2));
    this.player.hp = restoredHp;
    this.phase = 'BATTLE';
    this.screenState = 'BATTLE';
    this.turn = 'PLAYER';
    sound.playCoinChime();
    this.dealer.dialogue = `⚡ ВТОРОЙ ШАНС! Игрок вернулся в бой с +${restoredHp} HP!`;
    this.addLog(`Активирован Второй Шанс! Восстановлено +${restoredHp} HP!`);
    this.notifyUpdate();
  }

  buyShopItem(item: ItemCard) {
    if (this.player.chips >= (item.cost || 40)) {
      this.player.chips -= item.cost || 40;
      this.player.hand.push({ ...item });
      sound.playCoinChime();
      this.notifyUpdate();
    }
  }

  buyMetaUpgrade(type: keyof MetaUpgrades, cost: number) {
    if (this.player.chips >= cost) {
      this.player.chips -= cost;
      if (type === 'baseMaxHp') {
        this.metaUpgrades.baseMaxHp += 2;
        this.player.maxHp += 2;
        this.player.hp += 2;
      } else if (type === 'baseArmor') {
        this.metaUpgrades.baseArmor += 1;
        this.player.armor += 1;
      } else if (type === 'baseDamageBonus') {
        this.metaUpgrades.baseDamageBonus += 1;
      } else if (type === 'capitalBonus') {
        this.metaUpgrades.capitalBonus += 1;
      }

      sound.playCoinChime();
      this.notifyUpdate();
    }
  }

  notifyUpdate() {
    if (this.onUpdateUI) this.onUpdateUI();

    // Watchdog Auto-Recovery Failsafe:
    // If turn is DEALER, battle is active, and no timer is running or processing, schedule turn!
    if (
      this.phase === 'BATTLE' &&
      this.turn === 'DEALER' &&
      !this.dealerTurnTimeout &&
      !this.isDealerProcessing
    ) {
      this.scheduleDealerTurn(1200);
    }
  }
}
