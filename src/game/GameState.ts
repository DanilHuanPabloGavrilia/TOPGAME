import type { BulletType, ChamberState, DealerStats, GamePhase, GameTurn, ItemCard, ItemId, MetaUpgrades, PlayerStats, ScreenState } from './Types';
import { getRandomItems, isMultiplierCard, localizedItem, multiplierValue } from './ItemCatalog';
import { LOCATIONS, TRAINING_BOSS, localizedBoss } from './BossCatalog';
import { DealerAI, mostDangerousCardIndex } from './DealerAI';
import { sound } from '../engine/AudioSynthesizer';
import { saveManager } from '../engine/SaveManager';
import { SAVE_VERSION, type SaveData } from './SaveData';
import { t } from '../i18n';

const LOCATION_COUNT = 5;
const BOSSES_PER_LOCATION = 3;

// Payout for calling your own bluff: a blank fired into your own head. Capped per duel:
// the shot also keeps the turn, so an uncapped payout lets a player farm chips forever
// by never advancing the fight.
const BLANK_SELF_SHOT_CHIPS = 25;
const MAX_BLANK_SELF_SHOT_PAYOUTS = 5;

/**
 * Chips paid for beating [location][boss]. Single source of truth — the victory modal,
 * the defeat screen and the rewarded-ad payout all read from here.
 */
export const BOSS_REWARDS: number[][] = [
  [35, 60, 120],     // Loc 1
  [75, 120, 250],    // Loc 2
  [160, 260, 550],   // Loc 3
  [350, 580, 1200],  // Loc 4
  [800, 1400, 3000]  // Loc 5
];

/**
  * Losing pays a slice of what that specific boss was worth, never a flat per-location
  * figure. The old flat table drifted above the reward for a location's first boss, which
  * made throwing a duel the better move from location three onward.
  */
export const DEFEAT_SHARE = 0.15;

export function defeatReward(locIdx: number, bossIdx: number): number {
  const base = BOSS_REWARDS[locIdx]?.[bossIdx] ?? BOSS_REWARDS[0][0];
  return Math.max(5, Math.round(base * DEFEAT_SHARE));
}

/**
 * Meta upgrade prices. Quadratic in the level because location income grows ~24x across
 * the run while a linear price grows ~4x — with a linear step the first upgrade costs a
 * newcomer three locations of income and the last costs a veteran half of one.
 */
export function hpUpgradeCost(level: number): number { return 70 + 10 * level * level; }
export function armorUpgradeCost(level: number): number { return 150 + 12 * level * level; }
export function damageUpgradeCost(level: number): number { return 100 + 15 * level * level; }

// Rewarded ad for chips: a rolling window, because the platform cannot cap this for us.
// The reward is granted by our own onRewarded handler, so the limit has to live here.
export const AD_CHIPS_WINDOW_MS = 5 * 60 * 1000;
export const AD_CHIPS_MAX_IN_WINDOW = 3;

// The dealer can chain cards inside one turn, but each play costs the player ~2.5s of
// animation. Cap the combo so a fat hand can never stall the table.
const MAX_DEALER_CARDS_PER_TURN = 3;

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

  /** Timestamps of granted chip ads, kept inside the rolling window. */
  private adChipsGrants: number[] = [];

  /** Paid blank self-shots this duel; resets with every encounter. */
  private blankSelfShotPayouts = 0;

  metaUpgrades: MetaUpgrades = {
    baseMaxHp: 80,
    baseArmor: 0,
    baseDamageBonus: 0
  };

  getEnemyBaseDamage(): number {
    // The trainer hits for a flat, survivable amount — a newcomer must be able to lose a
    // few exchanges while reading the interface and still finish the bout.
    if (this.isTrainingBattle) return 5;

    const loc = this.currentLocationIndex; // 0 to 4
    const isBoss = this.currentBossIndex === 2; // 3rd boss (index 2) of location

    let baseDmg = 10;
    if (isBoss) {
      // Boss Base Damage: 10 (Loc 1) -> 25 (Loc 5)
      baseDmg = 10 + (loc * 3.75);
    } else {
      // Regular Minions Base Damage: 10 (Loc 1) -> 15 (Loc 5)
      baseDmg = 10 + (loc * 1.25);
    }

    // 1.5x damage boost for bosses and minions from Location 2+
    if (loc >= 1) {
      baseDmg *= 1.5;
    }

    // The 3.75/1.25 steps crossed with x1.5 land on halves and eighths (16.875, 20.625…).
    // Round here so nothing downstream can surface a decimal.
    return Math.round(baseDmg);
  }

  player: PlayerStats = {
    hp: 80,
    maxHp: 80,
    hand: [],
    chips: 100,
    relics: [],
    armor: 0
  };

  dealer: DealerStats = {
    name: '',
    avatar: '🤖',
    hp: 40,
    maxHp: 40,
    armor: 0,
    hand: [],
    dialogue: DealerAI.getDialogue('START')
  };

  chamber: ChamberState = {
    bullets: [],
    currentIndex: 0,
    knownBullets: [],
    dealerKnownBullets: []
  };

  damageMultiplier = 1;
  mirrorShieldActive = { player: false, dealer: false };
  isShooting = false;
  combatLog: string[] = [];

  private dealerTurnTimeout: any = null;
  private isDealerProcessing = false;
  private dealerCardsThisTurn = 0;

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
    this.isTrainingBattle = false;
    this.currentLocationIndex = locIdx;
    this.currentBossIndex = bossIdx;
    this.hasUsedReviveThisBattle = false;

    const location = LOCATIONS[locIdx];
    // Resolved once, here: everything downstream copies plain text out of it and never has
    // to know that the catalog stores keys.
    const bossDef = localizedBoss(location.bosses[bossIdx]);

    // Apply Meta Upgrades & Ad Buffs
    const extraHp = adBuff ? adBuff.hp : 0;
    const extraArmor = adBuff ? adBuff.armor : 0;

    this.player.maxHp = this.metaUpgrades.baseMaxHp + extraHp;
    this.player.hp = this.player.maxHp;
    this.player.armor = this.metaUpgrades.baseArmor + extraArmor;

    // Boss Stats
    this.dealer.name = bossDef.name;
    this.dealer.avatar = bossDef.avatar;
    this.dealer.avatarUrl = bossDef.avatarUrl;
    this.dealer.maxHp = bossDef.hp;
    this.dealer.hp = bossDef.hp;
    this.dealer.armor = bossDef.armor || 0;

    // Hands
    this.player.hand = getRandomItems(3);
    this.dealer.hand = getRandomItems(3);
    sound.playRoundStart();

    this.reloadChamber();
    this.dealerCardsThisTurn = 0;
    this.blankSelfShotPayouts = 0;
    this.phase = 'BATTLE';
    this.turn = 'PLAYER';
    this.screenState = 'BATTLE';
    this.dealer.dialogue = bossDef.dialogueSet[0] || DealerAI.getDialogue('START');
    this.notifyUpdate();
  }

  /**
   * Opens the sparring bout. Mirrors startBossEncounter but skips everything tied to
   * progression, and deals a hand chosen to demonstrate rather than at random.
   */
  startTrainingBattle() {
    this.isTrainingBattle = true;
    this.hasUsedReviveThisBattle = false;

    this.player.maxHp = this.metaUpgrades.baseMaxHp;
    this.player.hp = this.player.maxHp;
    this.player.armor = this.metaUpgrades.baseArmor;

    const trainer = localizedBoss(TRAINING_BOSS);
    this.dealer.name = trainer.name;
    this.dealer.avatar = trainer.avatar;
    this.dealer.avatarUrl = trainer.avatarUrl;
    this.dealer.maxHp = TRAINING_BOSS.hp;
    this.dealer.hp = TRAINING_BOSS.hp;
    this.dealer.armor = 0;

    // A readable opening hand: look at the round, double the damage, patch yourself up.
    this.player.hand = (['MAGNIFIER', 'SAW', 'CIGARETTE'] as ItemId[]).map(id => localizedItem(id));
    // The trainer plays no cards — one new mechanic at a time.
    this.dealer.hand = [];
    sound.playRoundStart();

    this.reloadChamber({ firstBlank: true });
    this.dealerCardsThisTurn = 0;
    this.blankSelfShotPayouts = 0;
    this.combatLog = [`• ${t('log.trainingStart')}`];
    this.phase = 'BATTLE';
    this.turn = 'PLAYER';
    this.screenState = 'BATTLE';
    this.dealer.dialogue = trainer.dialogueSet[0];
    this.notifyUpdate();
  }

  reloadChamber(opts?: { firstBlank?: boolean }) {
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

    // The tutorial teaches "a blank into your own head keeps the turn and pays". That
    // lesson only lands if the first round really is a blank, so sparring stacks it.
    if (opts?.firstBlank) {
      const blankAt = bullets.indexOf('BLANK');
      if (blankAt > 0) [bullets[0], bullets[blankAt]] = [bullets[blankAt], bullets[0]];
    }

    this.chamber = {
      bullets,
      currentIndex: 0,
      knownBullets: Array(count).fill(null),
      dealerKnownBullets: Array(count).fill(null)
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
          ? t('shot.player.self.live', { dmg: formatHp(dmg) })
          : DealerAI.getDialogue('PLAYER_SHOOT_DEALER_LIVE');
      }
      return isSelfShot
        ? t('shot.dealer.self.live', { dmg: formatHp(dmg) })
        : t('shot.dealer.you.live', { dmg: formatHp(dmg) });
    }

    if (shooter === 'PLAYER') {
      if (!isSelfShot) return t('shot.player.other.blank');
      // Once the per-duel payout cap is spent the move still keeps the turn, so say that
      // outright — a silent zero would read as a bug.
      return chips > 0
        ? t('shot.player.self.blank.paid', { chips })
        : t('shot.player.self.blank.capped');
    }
    return isSelfShot
      ? t('shot.dealer.self.blank')
      : t('shot.dealer.you.blank');
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

    // Built as one phrase per language rather than glued from a subject and an object:
    // Russian needs the accusative here, and Turkish would want a case suffix on the noun.
    // Concatenating two fragments produces something no translator can make read naturally.
    const who = shooter === 'PLAYER' ? 'player' : 'dealer';
    const at = isSelfShot ? 'self' : (victim === 'DEALER' ? 'dealer' : 'player');
    const shotPhrase = t(`log.shot.${who}.${at}`);

    if (isLive) {
      if (this.onScreenFlash) this.onScreenFlash('live');
      sound.playLiveShot();

      const baseDmg = shooter === 'PLAYER'
        ? (10 + this.metaUpgrades.baseDamageBonus * 5)
        : this.getEnemyBaseDamage();
      let dmg = baseDmg * this.damageMultiplier;
      this.damageMultiplier = 1;

      // Cap only the round the player puts into his own head, so one bullet can't end a run.
      if (isSelfShot && victim === 'PLAYER') dmg = Math.min(30, dmg);

      const victimShielded = victim === 'PLAYER'
        ? this.mirrorShieldActive.player
        : this.mirrorShieldActive.dealer;

      if (victimShielded) {
        // The mirror throws the round across the table, onto the opposite side.
        if (victim === 'PLAYER') this.mirrorShieldActive.player = false;
        else this.mirrorShieldActive.dealer = false;

        if (victim === 'PLAYER') {
          this.applyDamageToDealer(dmg);
          this.addLog(`${shotPhrase} ${t('log.reflected.dealer', { dmg: formatHp(dmg) })}`);
          this.dealer.dialogue = t('shield.reflected.dealer', { dmg: formatHp(dmg) });
        } else {
          this.applyDamageToPlayer(dmg);
          if (this.onFloatingText) this.onFloatingText(t('float.reflected', { dmg: formatHp(dmg) }), 'PLAYER', '#ff2a6d');
          this.addLog(`${shotPhrase} ${t('log.reflected.player', { dmg: formatHp(dmg) })}`);
          this.dealer.dialogue = t('shield.reflected.player', { dmg: formatHp(dmg) });
        }
      } else {
        if (victim === 'PLAYER') this.applyDamageToPlayer(dmg);
        else this.applyDamageToDealer(dmg);

        if (isSelfShot && victim === 'PLAYER' && this.onFloatingText) {
          this.onFloatingText(t('float.self.live', { dmg: formatHp(dmg) }), 'PLAYER', '#ff2a6d');
        }
        this.addLog(`${shotPhrase} ${t('log.live', { dmg: formatHp(dmg) })}`);
        this.dealer.dialogue = this.describeShot(shooter, victim, true, dmg, 0);
      }
    } else {
      // BLANK round
      if (this.onScreenFlash) this.onScreenFlash('blank');
      sound.playBlankClick();
      this.damageMultiplier = 1;

      let bonusChips = 0;
      if (isSelfShot && shooter === 'PLAYER') {
        const payoutsLeft = MAX_BLANK_SELF_SHOT_PAYOUTS - this.blankSelfShotPayouts;
        bonusChips = this.isTrainingBattle || payoutsLeft <= 0 ? 0 : BLANK_SELF_SHOT_CHIPS;
        if (bonusChips > 0) this.blankSelfShotPayouts++;
        this.player.chips += bonusChips;
        sound.playCoinChime();
        if (this.onFloatingText) {
          this.onFloatingText(t('float.self.blank', { chips: bonusChips }), 'PLAYER', '#00ff66');
          this.onFloatingText(t('float.chips', { chips: bonusChips }), 'CHIPS', '#ffb703');
        }
        this.addLog(`${shotPhrase} ${t('log.blank.paid', { chips: bonusChips })}`);
      } else {
        if (this.onFloatingText) this.onFloatingText(t('float.blank'), victim, '#05d9e8');
        this.addLog(`${shotPhrase} ${t('log.blank')}`);
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
      // The trainer stays card-less for the whole bout, not just the opening hand —
      // otherwise the restock hands him an Overdrive and the lesson turns into a beating.
      if (!this.isTrainingBattle) {
        this.dealer.hand.push(...getRandomItems(2));
      }
      sound.playCardSlide();
      this.dealer.dialogue = this.isTrainingBattle
        ? t('reload.training')
        : t('reload.normal');
    }

    // Only a blank fired into your own head keeps the turn. Everything else passes it.
    const keepsTurn = isSelfShot && !isLive;
    if (!keepsTurn) {
      this.turn = shooter === 'PLAYER' ? 'DEALER' : 'PLAYER';
    }

    if (this.turn === 'DEALER') {
      this.scheduleDealerTurn(keepsTurn ? 800 : 400);
    } else if (shooter === 'DEALER') {
      if (this.onFloatingText) this.onFloatingText(t('float.yourTurn'), 'PLAYER', '#00ff66');
    }

    this.notifyUpdate();
  }

  applyDamageToPlayer(amount: number) {
    let remainingDmg = amount;

    if (this.player.armor > 0) {
      const absorbed = Math.min(this.player.armor, remainingDmg);
      this.player.armor -= absorbed;
      remainingDmg -= absorbed;
      if (this.onFloatingText) this.onFloatingText(t('float.armor.player', { dmg: formatHp(absorbed) }), 'PLAYER', '#05d9e8');
    }
    if (remainingDmg > 0) {
      this.player.hp = Math.max(0, this.player.hp - remainingDmg);
      if (this.onFloatingText) this.onFloatingText(t('float.damage', { dmg: formatHp(remainingDmg) }), 'PLAYER', '#ff2a6d');
    }
  }

  applyDamageToDealer(amount: number) {
    let remainingDmg = amount;

    if (this.dealer.armor > 0) {
      const absorbed = Math.min(this.dealer.armor, remainingDmg);
      this.dealer.armor -= absorbed;
      remainingDmg -= absorbed;
      if (this.onFloatingText) this.onFloatingText(t('float.armor.dealer', { dmg: formatHp(absorbed) }), 'DEALER', '#05d9e8');
    }
    if (remainingDmg > 0) {
      this.dealer.hp = Math.max(0, this.dealer.hp - remainingDmg);
      if (this.onFloatingText) this.onFloatingText(t('float.damage', { dmg: formatHp(remainingDmg) }), 'DEALER', '#ff2a6d');
    }
  }

  /**
   * False while the card cannot legally be played. Only boosters are ever blocked, and only
   * because another multiplier is already standing. The UI greys these out instead of
   * letting the click fall through to a silent no-op.
   */
  canUseItem(item: ItemCard): boolean {
    return !(isMultiplierCard(item.id) && this.damageMultiplier > 1);
  }

  useItem(itemIndex: number, user: 'PLAYER' | 'DEALER') {
    const hand = user === 'PLAYER' ? this.player.hand : this.dealer.hand;
    if (itemIndex < 0 || itemIndex >= hand.length) return;

    const item = hand[itemIndex];

    // One booster per shot. A second multiplier is refused outright instead of overwriting
    // the first — and the card is not spent, it stays in hand until the shot clears the buff.
    if (!this.canUseItem(item)) {
      if (user === 'PLAYER') {
        this.dealer.dialogue = t('booster.locked', { mult: this.damageMultiplier });
        this.notifyUpdate();
      }
      return;
    }

    hand.splice(itemIndex, 1);
    sound.playItemPowerup();
    this.addLog(t(user === 'PLAYER' ? 'log.card.player' : 'log.card.dealer', { card: item.name }));

    const currIdx = this.chamber.currentIndex;

    switch (item.id) {
      case 'MAGNIFIER':
        if (currIdx < this.chamber.bullets.length) {
          const bullet = this.chamber.bullets[currIdx];
          if (user === 'PLAYER') {
            this.chamber.knownBullets[currIdx] = bullet;
            this.dealer.dialogue = t('card.magnifier.player', { bullet: t(bullet === 'LIVE' ? 'bullet.live' : 'bullet.blank') });
          } else {
            this.chamber.dealerKnownBullets[currIdx] = bullet;
            this.dealer.dialogue = t('card.magnifier.dealer');
          }
        }
        break;

      case 'SAW':
        this.damageMultiplier = multiplierValue('SAW')!;
        this.dealer.dialogue = t(user === 'PLAYER' ? 'card.saw.player' : 'card.saw.dealer', { mult: this.damageMultiplier });
        break;

      case 'ENERGY_DRINK':
        if (currIdx < this.chamber.bullets.length) {
          const ejected = this.chamber.bullets[currIdx];
          this.chamber.currentIndex++;
          this.dealer.dialogue = t(user === 'PLAYER' ? 'card.energy.player' : 'card.energy.dealer', { bullet: t(ejected === 'LIVE' ? 'bullet.live' : 'bullet.blank') });
          if (this.chamber.currentIndex >= this.chamber.bullets.length) {
            this.reloadChamber();
          }
        }
        break;

      case 'CIGARETTE':
        if (user === 'PLAYER') {
          const heal = Math.max(10, Math.round(this.player.maxHp * 0.1));
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
          if (this.onFloatingText) this.onFloatingText(t('float.heal', { hp: heal }), 'PLAYER', '#00ff66');
          this.dealer.dialogue = t('card.cigarette.player', { hp: heal });
        } else {
          const heal = Math.max(10, Math.round(this.dealer.maxHp * 0.1));
          this.dealer.hp = Math.min(this.dealer.maxHp, this.dealer.hp + heal);
          if (this.onFloatingText) this.onFloatingText(t('float.heal', { hp: heal }), 'DEALER', '#00ff66');
          this.dealer.dialogue = t('card.cigarette.dealer', { hp: heal });
        }
        break;

      case 'HACK_CHIP':
        if (currIdx < this.chamber.bullets.length) {
          const orig = this.chamber.bullets[currIdx];
          const flipped = orig === 'LIVE' ? 'BLANK' : 'LIVE';
          this.chamber.bullets[currIdx] = flipped;

          // Whoever flips it knows the result; the other side's note is now stale, so it
          // is cleared rather than left lying. They saw the card played — they know it moved.
          if (user === 'PLAYER') {
            this.chamber.knownBullets[currIdx] = flipped;
            this.chamber.dealerKnownBullets[currIdx] = null;
            this.dealer.dialogue = t('card.hack.player', { bullet: t(flipped === 'LIVE' ? 'bullet.live' : 'bullet.blank') });
          } else {
            this.chamber.dealerKnownBullets[currIdx] = flipped;
            this.chamber.knownBullets[currIdx] = null;
            this.dealer.dialogue = t('card.hack.dealer');
          }
        }
        break;

      case 'MIRROR_SHIELD':
        if (user === 'PLAYER') this.mirrorShieldActive.player = true;
        else this.mirrorShieldActive.dealer = true;
        this.dealer.dialogue = t(user === 'PLAYER' ? 'card.shield.player' : 'card.shield.dealer');
        break;

      case 'OVERDRIVE':
        this.damageMultiplier = multiplierValue('OVERDRIVE')!;
        this.dealer.dialogue = t('card.overdrive', { mult: this.damageMultiplier });
        break;

      case 'MAGNET': {
        const victimHand = user === 'PLAYER' ? this.dealer.hand : this.player.hand;
        const thiefHand = user === 'PLAYER' ? this.player.hand : this.dealer.hand;
        if (victimHand.length > 0) {
          const stolenIdx = Math.floor(Math.random() * victimHand.length);
          const stolenCard = victimHand.splice(stolenIdx, 1)[0];
          thiefHand.push(stolenCard);
          this.dealer.dialogue = user === 'PLAYER'
            ? t('card.magnet.player', { card: stolenCard.name })
            : t('card.magnet.dealer', { card: stolenCard.name });
        }
        break;
      }

      case 'XRAY': {
        const target = user === 'PLAYER' ? this.chamber.knownBullets : this.chamber.dealerKnownBullets;
        for (let i = 0; i < this.chamber.bullets.length; i++) {
          target[i] = this.chamber.bullets[i];
        }
        this.dealer.dialogue = user === 'PLAYER'
          ? t('card.xray.player')
          : t('card.xray.dealer');
        break;
      }

      case 'OVERDRIVE_2':
        this.damageMultiplier = multiplierValue('OVERDRIVE_2')!;
        this.dealer.dialogue = t('card.overdrive2', { mult: this.damageMultiplier });
        break;

      case 'NULLIFIER': {
        this.damageMultiplier = 1;
        const victimHand = user === 'PLAYER' ? this.dealer.hand : this.player.hand;
        if (victimHand.length > 0) {
          // Burn the most dangerous card rather than whatever sits last in the array.
          const burnIdx = mostDangerousCardIndex(victimHand);
          const burned = victimHand.splice(burnIdx, 1)[0];
          this.dealer.dialogue = user === 'PLAYER'
            ? t('card.nullifier.player', { card: burned.name })
            : t('card.nullifier.dealer', { card: burned.name });
        } else {
          this.dealer.dialogue = t('card.nullifier.empty');
        }
        break;
      }
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

      const decision = DealerAI.decideTurn({
        chamber: this.chamber,
        dealerHand: this.dealer.hand,
        playerHand: this.player.hand,
        dealerHp: this.dealer.hp,
        dealerMaxHp: this.dealer.maxHp,
        playerHp: this.player.hp,
        playerArmor: this.player.armor,
        damageMultiplier: this.damageMultiplier,
        dealerShieldUp: this.mirrorShieldActive.dealer
      });

      if (
        decision.action === 'USE_ITEM' &&
        decision.itemIndex !== undefined &&
        decision.itemIndex >= 0 &&
        decision.itemIndex < this.dealer.hand.length &&
        this.dealerCardsThisTurn < MAX_DEALER_CARDS_PER_TURN
      ) {
        const cardToUse = this.dealer.hand[decision.itemIndex];
        
        // Trigger visual card showcase in center of table
        if (this.onDealerShowcaseCard) {
          this.onDealerShowcaseCard(cardToUse);
        }

        // Hold showcase card on screen for 1.25 seconds
        await sleep(1250);

        if (this.onClearDealerFX) this.onClearDealerFX();

        this.dealerCardsThisTurn++;
        this.useItem(decision.itemIndex, 'DEALER');
        this.isDealerProcessing = false;
        this.scheduleDealerTurn(1200);
      } else {
        // Committing to a shot ends the combo; the budget resets for the next turn.
        this.dealerCardsThisTurn = 0;
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
      this.dealerCardsThisTurn = 0;
      this.shootTarget('PLAYER');
    }
  }

  handleBossVictory() {
    sound.playCoinChime();

    // Sparring pays nothing and unlocks nothing; it only reports that it is over.
    if (this.isTrainingBattle) {
      this.phase = 'VICTORY';
      this.dealer.dialogue = t('outcome.training.win');
      this.notifyUpdate();
      return;
    }

    const currentLoc = this.currentLocationIndex;
    const currentBoss = this.currentBossIndex;

    // Mark current boss as completed!
    this.completedBosses[currentLoc][currentBoss] = true;

    const baseReward = BOSS_REWARDS[currentLoc]?.[currentBoss] || 35;
    const reward = baseReward;
    this.player.chips += reward;

    if (currentBoss < 2) {
      // Advance to next boss in same location!
      this.currentBossIndex = currentBoss + 1;
      this.phase = 'SHOP';
      this.dealer.dialogue = t('outcome.boss.win', { boss: currentBoss + 1, reward, next: this.currentBossIndex + 1 });
    } else {
      // Completed Location 3/3 Bosses!
      if (currentLoc < 4) {
        this.unlockedLocationIndex = Math.max(this.unlockedLocationIndex, currentLoc + 1);
        this.currentLocationIndex = currentLoc + 1;
        this.currentBossIndex = 0;
        this.phase = 'SHOP';
        this.dealer.dialogue = t('outcome.location.done', { done: currentLoc + 1, next: this.currentLocationIndex + 1 });
      } else {
        this.screenState = 'VICTORY';
      }
    }

    this.requestSave();
    this.notifyUpdate();
  }

  handlePlayerDefeatRewind() {
    sound.playBlankClick();

    if (this.isTrainingBattle) {
      this.phase = 'GAMEOVER';
      this.dealer.dialogue = t('outcome.training.lose');
      this.notifyUpdate();
      return;
    }


    // Consolation reward on defeat scaling with location (Option 1)
    const consolation = defeatReward(this.currentLocationIndex, this.currentBossIndex);
    this.player.chips += consolation;

    this.phase = 'GAMEOVER';
    // `consolation`, not `defeatReward` — the latter is the function, and interpolating it
    // dropped its whole source text into the sentence the player reads on defeat.
    this.dealer.dialogue = t('outcome.defeat', { chips: consolation });
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

  /** Sparring mode: no payout, no progression, and a cylinder stacked for teaching. */
  isTrainingBattle = false;

  revivePlayerWith20PercentHp() {
    this.hasUsedReviveThisBattle = true;
    const restoredHp = Math.max(20, Math.ceil(this.player.maxHp * 0.2));
    this.player.hp = restoredHp;
    this.phase = 'BATTLE';
    this.screenState = 'BATTLE';
    this.turn = 'PLAYER';
    sound.playCoinChime();
    this.dealer.dialogue = t('outcome.revive', { hp: restoredHp });
    this.addLog(t('log.revive', { hp: restoredHp }));
    this.notifyUpdate();
  }

  /** Drops grants that fell out of the window, and any left in the future by a clock change. */
  private pruneAdChipsGrants(now: number = Date.now()) {
    this.adChipsGrants = this.adChipsGrants
      .filter(t => Number.isFinite(t) && t <= now && t > now - AD_CHIPS_WINDOW_MS)
      .sort((a, b) => a - b);
  }

  /** How many chip ads are left, and how long until the next one frees up. */
  getAdChipsStatus(): { remaining: number; nextAvailableInMs: number } {
    this.pruneAdChipsGrants();
    const remaining = Math.max(0, AD_CHIPS_MAX_IN_WINDOW - this.adChipsGrants.length);
    const nextAvailableInMs = remaining > 0
      ? 0
      : Math.max(0, this.adChipsGrants[0] + AD_CHIPS_WINDOW_MS - Date.now());
    return { remaining, nextAvailableInMs };
  }

  /**
   * Payout for one chip ad: half of what the boss in front of you is worth. A flat figure
   * would dwarf the whole first location and mean nothing by the fifth.
   */
  getAdChipsReward(): number {
    const base = BOSS_REWARDS[this.currentLocationIndex]?.[this.currentBossIndex]
      ?? BOSS_REWARDS[0][0];
    return Math.max(1, Math.round(base / 2));
  }

  /** Books a granted ad and pays out. Returns 0 when the window is already spent. */
  grantAdChips(): number {
    if (this.getAdChipsStatus().remaining <= 0) return 0;

    const amount = this.getAdChipsReward();
    this.adChipsGrants.push(Date.now());
    this.player.chips += amount;
    this.requestSave();
    return amount;
  }

  buyMetaUpgrade(type: keyof MetaUpgrades, cost: number) {
    if (this.player.chips >= cost) {
      this.player.chips -= cost;
      if (type === 'baseMaxHp') {
        this.metaUpgrades.baseMaxHp += 20;
        this.player.maxHp += 20;
        this.player.hp += 20;
      } else if (type === 'baseArmor') {
        this.metaUpgrades.baseArmor += 10;
        this.player.armor += 10;
      } else if (type === 'baseDamageBonus') {
        this.metaUpgrades.baseDamageBonus += 1;
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
      muted: sound.isMuted,
      adChipsGrants: [...this.adChipsGrants]
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
      // v1 stored HP and armor on the old x1 scale. They are absolute values, not level
      // counters, so they need converting — 8 + 2·lvl becomes 80 + 20·lvl exactly.
      // baseDamageBonus is a level counter and carries over untouched.
      const scale = (data.version ?? 1) < 2 ? 10 : 1;
      this.metaUpgrades = {
        baseMaxHp: num(meta.baseMaxHp * scale, 80, 80, 99999),
        baseArmor: num(meta.baseArmor * scale, 0, 0, 99999),
        baseDamageBonus: num(meta.baseDamageBonus, 0, 0, 9999)
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

    // Reloading must not hand back a fresh set of ad views.
    this.adChipsGrants = Array.isArray(data.adChipsGrants)
      ? data.adChipsGrants.filter((t: unknown): t is number => typeof t === 'number' && Number.isFinite(t))
      : [];
    this.pruneAdChipsGrants();

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
