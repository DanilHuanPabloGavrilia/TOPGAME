import type { BulletType, ChamberState, DealerStats, GamePhase, GameTurn, ItemCard, MetaUpgrades, PlayerStats, ScreenState } from './Types';
import { getRandomItems } from './ItemCatalog';
import { LOCATIONS } from './BossCatalog';
import { DealerAI } from './DealerAI';
import { sound } from '../engine/AudioSynthesizer';
import { saveManager } from '../engine/SaveManager';
import { SAVE_VERSION, type SaveData } from './SaveData';

const LOCATION_COUNT = 5;
const BOSSES_PER_LOCATION = 3;

function emptyBossMatrix(): boolean[][] {
  return Array.from({ length: LOCATION_COUNT }, () => Array(BOSSES_PER_LOCATION).fill(false));
}

export function formatHp(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

export class GameState {
  screenState: ScreenState = 'MAIN_MENU';
  phase: GamePhase = 'BATTLE';
  turn: GameTurn = 'PLAYER';

  // Location & Boss Progression (5 Locations x 3 Bosses = 15 Bosses)
  currentLocationIndex = 0;
  currentBossIndex = 0;
  unlockedLocationIndex = 0;

  // Completed bosses matrix: 5 locations x 3 bosses
  completedBosses: boolean[][] = emptyBossMatrix();

  private saveCounter = 0;

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
  onDealerShowcaseCard?: (card: ItemCard) => void;
  onDealerTargeting?: (target: 'PLAYER' | 'DEALER') => void;
  onClearDealerFX?: () => void;

  addLog(entry: string) {
    this.combatLog.unshift(`• ${entry}`);
    if (this.combatLog.length > 4) {
      this.combatLog.pop();
    }
  }

  scheduleDealerTurn(delayMs: number = 1000) {
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
    sound.playCardSlide();

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
  }

  // Narration for a resolved shot. `shooter` pulled the trigger, `victim` took the round —
  // they only coincide on a deliberate self-shot.
  private describeShot(shooter: GameTurn, victim: GameTurn, isLive: boolean, dmg: number, chips: number): string {
    const isSelfShot = shooter === victim;

    if (isLive) {
      if (shooter === 'PLAYER') {
        return isSelfShot
          ? `💥 БОЕВОЙ В СЕБЯ! Урон -${formatHp(dmg)} HP. Ход перешел к Диллеру!`
          : DealerAI.getDialogue('PLAYER_SHOOT_DEALER_LIVE');
      }
      return isSelfShot
        ? `💥 Диллер выстрелил В СЕБЯ: БОЕВОЙ! -${formatHp(dmg)} HP. Ваш ход!`
        : `🎯 Диллер выстрелил В ВАС: БОЕВОЙ! -${formatHp(dmg)} HP. Ваш ход!`;
    }

    if (shooter === 'PLAYER') {
      return isSelfShot
        ? `🔥 АДРЕНАЛИНОВЫЙ БОНУС! Холостой по себе: +${chips}$ и Повторный Ход!`
        : `💨 ЩЕЛЧОК! Холостой патрон (0 урона). Ход передается Диллеру!`;
    }
    return isSelfShot
      ? `💨 Диллер выстрелил В СЕБЯ: ХОЛОСТОЙ! (0 урона). Диллер берет повторный ход...`
      : `💨 Диллер выстрелил В ВАС: ХОЛОСТОЙ! (0 урона). Ваш ход!`;
  }

  shootTarget(target: 'DEALER' | 'PLAYER') {
    if (this.phase !== 'BATTLE') return;

    if (this.chamber.currentIndex >= this.chamber.bullets.length) {
      this.reloadChamber();
    }

    // Who fires vs who is fired at. These coincide only on a deliberate self-shot —
    // every rule below keys off that instead of assuming PLAYER always means "myself".
    const shooter: GameTurn = this.turn;
    const victim: GameTurn = target;
    const isSelfShot = shooter === victim;

    const currentBullet = this.chamber.bullets[this.chamber.currentIndex];
    const isLive = currentBullet === 'LIVE';

    this.chamber.currentIndex++;
    const isChamberEmpty = this.chamber.currentIndex >= this.chamber.bullets.length;

    const shooterLabel = shooter === 'PLAYER' ? 'Вы выстрелили' : 'Диллер выстрелил';
    const victimLabel = isSelfShot ? 'в себя' : (victim === 'DEALER' ? 'в Диллера' : 'в вас');

    if (isLive) {
      if (this.onScreenFlash) this.onScreenFlash('live');
      sound.playLiveShot();

      const baseDmg = shooter === 'PLAYER'
        ? (1 + this.metaUpgrades.baseDamageBonus * 0.5)
        : this.getEnemyBaseDamage();
      let dmg = baseDmg * this.damageMultiplier;
      this.damageMultiplier = 1;

      // Cap only the round the player puts into his own head, so one bullet can't end a run.
      if (isSelfShot && victim === 'PLAYER') dmg = Math.min(3, dmg);

      const victimShielded = victim === 'PLAYER'
        ? this.mirrorShieldActive.player
        : this.mirrorShieldActive.dealer;

      if (victimShielded) {
        // The mirror throws the round across the table, onto the opposite side.
        if (victim === 'PLAYER') this.mirrorShieldActive.player = false;
        else this.mirrorShieldActive.dealer = false;

        if (victim === 'PLAYER') {
          this.applyDamageToDealer(dmg);
          this.addLog(`${shooterLabel} ${victimLabel} (🪞 Отражено -${formatHp(dmg)} HP Диллеру)`);
          this.dealer.dialogue = `🪞 ЗЕРКАЛЬНЫЙ ЩИТ! Пуля отражена в Диллера: -${formatHp(dmg)} HP!`;
        } else {
          this.applyDamageToPlayer(dmg);
          if (this.onFloatingText) this.onFloatingText(`-${formatHp(dmg)} HP (ОТРАЖЕНО!)`, 'PLAYER', '#ff2a6d');
          this.addLog(`${shooterLabel} ${victimLabel} (🪞 Отражено -${formatHp(dmg)} HP вам)`);
          this.dealer.dialogue = `🪞 ЗЕРКАЛЬНЫЙ ЩИТ ДИЛЛЕРА! Пуля отражена в вас: -${formatHp(dmg)} HP!`;
        }
      } else {
        if (victim === 'PLAYER') this.applyDamageToPlayer(dmg);
        else this.applyDamageToDealer(dmg);

        if (isSelfShot && victim === 'PLAYER' && this.onFloatingText) {
          this.onFloatingText(`🔴 БОЕВОЙ В СЕБЯ! -${formatHp(dmg)} HP`, 'PLAYER', '#ff2a6d');
        }
        this.addLog(`${shooterLabel} ${victimLabel} (🔴 Боевой -${formatHp(dmg)} HP)`);
        this.dealer.dialogue = this.describeShot(shooter, victim, true, dmg, 0);
      }
    } else {
      // BLANK round
      if (this.onScreenFlash) this.onScreenFlash('blank');
      sound.playBlankClick();
      this.damageMultiplier = 1;

      let bonusChips = 0;
      if (isSelfShot && shooter === 'PLAYER') {
        bonusChips = Math.round(25 * this.getChipsMultiplier());
        this.player.chips += bonusChips;
        sound.playCoinChime();
        if (this.onFloatingText) {
          this.onFloatingText(`🔵 ХОЛОСТОЙ В СЕБЯ! (+${bonusChips}$)`, 'PLAYER', '#00ff66');
          this.onFloatingText(`+${bonusChips} $ 💰`, 'CHIPS', '#ffb703');
        }
        this.addLog(`${shooterLabel} ${victimLabel} (🔵 Холостой +${bonusChips}$)`);
      } else {
        if (this.onFloatingText) this.onFloatingText('🔵 ХОЛОСТОЙ! (0 УРОНА)', victim, '#05d9e8');
        this.addLog(`${shooterLabel} ${victimLabel} (🔵 Холостой 0 HP)`);
      }

      this.dealer.dialogue = this.describeShot(shooter, victim, false, 0, bonusChips);
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

    // Only a blank fired into your own head keeps the turn. Everything else passes it.
    const keepsTurn = isSelfShot && !isLive;
    if (!keepsTurn) {
      this.turn = shooter === 'PLAYER' ? 'DEALER' : 'PLAYER';
    }

    if (this.turn === 'DEALER') {
      this.scheduleDealerTurn(keepsTurn ? 800 : 400);
    } else if (shooter === 'DEALER') {
      if (this.onFloatingText) this.onFloatingText('⚡ ВАШ ХОД!', 'PLAYER', '#00ff66');
    }

    this.notifyUpdate();
  }

  applyDamageToPlayer(amount: number) {
    let remainingDmg = amount;

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
    this.addLog(`${user === 'PLAYER' ? 'Вы применили' : 'Диллер применил'} карту «${item.name}»`);

    const currIdx = this.chamber.currentIndex;

    switch (item.id) {
      case 'MAGNIFIER':
        if (currIdx < this.chamber.bullets.length) {
          const bullet = this.chamber.bullets[currIdx];
          this.chamber.knownBullets[currIdx] = bullet;
          if (user === 'PLAYER') {
            this.dealer.dialogue = `Вы посмотрели в лупу: текущий патрон — ${bullet === 'LIVE' ? 'БОЕВОЙ 🔴' : 'ХОЛОСТОЙ 🔵'}.`;
          } else {
            this.dealer.dialogue = `🔍 Диллер посмотрел в лупу и узнал секретный патрон!`;
          }
        }
        break;

      case 'SAW':
        this.damageMultiplier = 2;
        this.dealer.dialogue = `${user === 'PLAYER' ? 'Вы подпилили' : 'Диллер подпилил'} ствол! Урон следующего выстрела х2!`;
        break;

      case 'ENERGY_DRINK':
        if (currIdx < this.chamber.bullets.length) {
          const ejected = this.chamber.bullets[currIdx];
          this.chamber.currentIndex++;
          this.dealer.dialogue = `${user === 'PLAYER' ? 'Вы выбросили' : 'Диллер выбросил'} патрон (${ejected === 'LIVE' ? 'БОЕВОЙ 🔴' : 'ХОЛОСТОЙ 🔵'}).`;
          if (this.chamber.currentIndex >= this.chamber.bullets.length) {
            this.reloadChamber();
          }
        }
        break;

      case 'CIGARETTE':
        if (user === 'PLAYER') {
          const heal = Math.max(1, Math.round(this.player.maxHp * 0.1));
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
          if (this.onFloatingText) this.onFloatingText(`+${heal} HP (10%) 🚬`, 'PLAYER', '#00ff66');
          this.dealer.dialogue = `Вы выкурили сигарету (+${heal} HP / 10%).`;
        } else {
          const heal = Math.max(1, Math.round(this.dealer.maxHp * 0.1));
          this.dealer.hp = Math.min(this.dealer.maxHp, this.dealer.hp + heal);
          if (this.onFloatingText) this.onFloatingText(`+${heal} HP (10%) 🚬`, 'DEALER', '#00ff66');
          this.dealer.dialogue = `Диллер выкурил сигарету (+${heal} HP / 10%).`;
        }
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
        this.dealer.dialogue = `${user === 'PLAYER' ? 'Вы активировали' : 'Диллер активировал'} Зеркальный Щит!`;
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

  async processDealerTurn() {
    if (this.phase !== 'BATTLE' || this.turn !== 'DEALER') {
      this.isDealerProcessing = false;
      return;
    }

    if (this.isDealerProcessing) return;
    this.isDealerProcessing = true;

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // 1. Initial thinking pause (1.0 seconds)
      await sleep(1000);

      if (this.phase !== 'BATTLE' || this.turn !== 'DEALER') {
        this.isDealerProcessing = false;
        return;
      }

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
        const cardToUse = this.dealer.hand[decision.itemIndex];
        
        // Trigger visual card showcase in center of table
        if (this.onDealerShowcaseCard) {
          this.onDealerShowcaseCard(cardToUse);
        }

        // Hold showcase card on screen for 1.25 seconds
        await sleep(1250);

        if (this.onClearDealerFX) this.onClearDealerFX();

        this.useItem(decision.itemIndex, 'DEALER');
        this.isDealerProcessing = false;
        this.scheduleDealerTurn(1200);
      } else {
        const target = decision.action === 'SHOOT_PLAYER' ? 'PLAYER' : 'DEALER';

        // 1-second laser targeting phase before firing
        if (this.onDealerTargeting) {
          this.onDealerTargeting(target);
        }

        await sleep(1000);

        if (this.onClearDealerFX) this.onClearDealerFX();

        this.isDealerProcessing = false;
        this.shootTarget(target);
      }
    } catch (err) {
      console.error('Dealer AI turn error:', err);
      if (this.onClearDealerFX) this.onClearDealerFX();
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

    // Progressive Option 1 Rewards Matrix: [locIdx][bossIdx]
    const rewardsMatrix = [
      [35, 60, 120],     // Loc 1
      [75, 120, 250],    // Loc 2
      [160, 260, 550],   // Loc 3
      [350, 580, 1200],  // Loc 4
      [800, 1400, 3000]  // Loc 5
    ];

    const baseReward = rewardsMatrix[currentLoc]?.[currentBoss] || 35;
    const reward = Math.round(baseReward * this.getChipsMultiplier());
    this.player.chips += reward;

    if (currentBoss < 2) {
      // Advance to next boss in same location!
      this.currentBossIndex = currentBoss + 1;
      this.phase = 'SHOP';
      this.dealer.dialogue = `🎉 ПОБЕДА! Босс ${currentBoss + 1} повержен! Заработано +${reward}$. Подготовьтесь к Боссу ${this.currentBossIndex + 1}.`;
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

    this.requestSave();
    this.notifyUpdate();
  }

  handlePlayerDefeatRewind() {
    sound.playBlankClick();

    // Consolation reward on defeat scaling with location (Option 1)
    const defeatRewards = [15, 35, 80, 180, 450];
    const baseDefeat = defeatRewards[this.currentLocationIndex] || 15;
    const defeatReward = Math.round(baseDefeat * this.getChipsMultiplier());
    this.player.chips += defeatReward;

    this.phase = 'GAMEOVER';
    this.dealer.dialogue = `💀 ПОРАЖЕНИЕ! Вам выплачена компенсация +${defeatReward}$. Зайдите в Мета-Прокачку или на Карту Мира!`;
    this.requestSave();
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
      this.requestSave();
      this.notifyUpdate();
    }
  }

  /** Snapshot of everything that must survive a reload. */
  serialize(): SaveData {
    this.saveCounter++;
    return {
      version: SAVE_VERSION,
      saveCounter: this.saveCounter,
      chips: this.player.chips,
      metaUpgrades: { ...this.metaUpgrades },
      completedBosses: this.completedBosses.map(row => [...row]),
      unlockedLocationIndex: this.unlockedLocationIndex,
      currentLocationIndex: this.currentLocationIndex,
      currentBossIndex: this.currentBossIndex,
      muted: sound.isMuted
    };
  }

  /** Queues a debounced write. Call after anything the player would hate to redo. */
  requestSave() {
    saveManager.queue(this.serialize());
  }

  /**
   * Restores a snapshot. Every field is validated because the blob can come from an older
   * build, a hand-edited localStorage entry, or a partially written cloud record — a bad
   * save must degrade to a fresh start, never to a broken one.
   */
  applySave(data: SaveData | null) {
    if (!data || typeof data !== 'object') return;

    const num = (val: unknown, fallback: number, min: number, max: number) =>
      typeof val === 'number' && Number.isFinite(val) ? Math.min(max, Math.max(min, val)) : fallback;

    this.saveCounter = num(data.saveCounter, 0, 0, Number.MAX_SAFE_INTEGER);
    this.player.chips = num(data.chips, 100, 0, Number.MAX_SAFE_INTEGER);

    const meta = data.metaUpgrades;
    if (meta && typeof meta === 'object') {
      this.metaUpgrades = {
        baseMaxHp: num(meta.baseMaxHp, 8, 8, 9999),
        baseArmor: num(meta.baseArmor, 0, 0, 9999),
        baseDamageBonus: num(meta.baseDamageBonus, 0, 0, 9999),
        capitalBonus: num(meta.capitalBonus, 0, 0, 9999)
      };
    }

    this.player.maxHp = this.metaUpgrades.baseMaxHp;
    this.player.hp = this.player.maxHp;
    this.player.armor = this.metaUpgrades.baseArmor;

    const matrix = emptyBossMatrix();
    if (Array.isArray(data.completedBosses)) {
      for (let loc = 0; loc < LOCATION_COUNT; loc++) {
        for (let boss = 0; boss < BOSSES_PER_LOCATION; boss++) {
          matrix[loc][boss] = data.completedBosses[loc]?.[boss] === true;
        }
      }
    }
    this.completedBosses = matrix;

    this.unlockedLocationIndex = num(data.unlockedLocationIndex, 0, 0, LOCATION_COUNT - 1);
    this.currentLocationIndex = num(data.currentLocationIndex, 0, 0, LOCATION_COUNT - 1);
    this.currentBossIndex = num(data.currentBossIndex, 0, 0, BOSSES_PER_LOCATION - 1);

    if (typeof data.muted === 'boolean') sound.setMuted(data.muted);
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
