// Step-by-step spotlight tutorial.
//
// Two things about this game shape the design:
//
//   1. renderUI() rebuilds whole containers with innerHTML on every state change, so any
//      element reference goes stale within milliseconds. Nothing here caches a node — the
//      selector is re-resolved and re-measured on every frame the tutorial is visible.
//   2. Screens swap by toggling a class, and the element a step points at may not exist
//      yet. A step whose screen is not on-screen parks the tutorial instead of failing.

import { t } from '../i18n';

export type TutorialScreen = 'ANY' | 'MAIN_MENU' | 'WORLD_MAP' | 'META_SHOP' | 'BATTLE' | 'BOSS_INTRO';

export interface TutorialStep {
  /** Which screen this step belongs to. 'ANY' pins to always-visible chrome like the header. */
  screen: TutorialScreen;
  selector: string;
  text: string;
  /** Preferred tooltip side. Flipped automatically when it would fall off-screen. */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Wait for the player to click the highlighted element instead of showing "Далее". */
  actionRequired?: 'click';
  /** Advance as soon as this returns true — for steps the engine resolves on its own. */
  waitFor?: () => boolean;
  /** Fired once when the step first paints. */
  onEnter?: () => void;
  /** Skip the step entirely when this returns false. */
  precondition?: () => boolean;
}

const PADDING = 8;         // breathing room between the cutout and the element
const TOOLTIP_GAP = 14;    // distance from the cutout to the tooltip
const TOOLTIP_WIDTH = 300;
const RESOLVE_TIMEOUT_MS = 6000; // give up waiting for a selector that never appears

export class TutorialManager {
  private steps: TutorialStep[] = [];
  private index = -1;
  private active = false;
  private currentScreen: TutorialScreen = 'MAIN_MENU';

  private root!: HTMLElement;
  private spotlight!: HTMLElement;
  private tooltip!: HTMLElement;
  private tooltipText!: HTMLElement;
  private tooltipCounter!: HTMLElement;
  private btnNext!: HTMLButtonElement;
  private btnSkip!: HTMLButtonElement;
  private arrow!: HTMLElement;

  private rafId: number | null = null;
  private waitingSince = 0;
  private lastTarget: Element | null = null;
  /** Detaches the pending actionRequired listener. Must run before any rebind or stop. */
  private actionCleanup: (() => void) | null = null;

  /** Fired when the run ends, either finished or skipped. */
  onFinish?: (completed: boolean) => void;

  constructor() {
    this.buildDom();
  }

  // ---------------------------------------------------------------- lifecycle

  init(steps: TutorialStep[]) {
    this.steps = steps;
  }

  start(fromIndex = 0) {
    if (!this.steps.length) return;
    this.applyChrome();
    this.active = true;
    this.index = fromIndex - 1;
    this.root.classList.add('active');
    this.next();
  }

  stop(completed: boolean) {
    if (!this.active) return;
    this.active = false;
    this.index = -1;
    this.lastTarget = null;
    this.clearAction();
    this.root.classList.remove('active', 'waiting');
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.onFinish) this.onFinish(completed);
  }

  isRunning(): boolean {
    return this.active;
  }

  /**
   * Called by the game whenever the visible screen changes. A parked tutorial wakes up
   * here — this is what lets a run span the shop, the dossier and the duel.
   */
  changeScreen(screen: TutorialScreen) {
    if (this.currentScreen === screen) return;
    this.currentScreen = screen;
    if (!this.active) return;

    // Re-evaluate immediately: the step we are parked on may live on this screen.
    this.waitingSince = Date.now();
    this.render();
  }

  // ------------------------------------------------------------------- steps

  private get step(): TutorialStep | null {
    return this.steps[this.index] ?? null;
  }

  next() {
    if (!this.active) return;

    // Walk forward past any step whose precondition rules it out.
    do {
      this.index++;
    } while (this.step && this.step.precondition && !this.step.precondition());

    if (!this.step) {
      this.stop(true);
      return;
    }

    this.lastTarget = null;
    this.clearAction();
    this.waitingSince = Date.now();
    this.step.onEnter?.();
    this.render();
    this.loop();
  }

  // ------------------------------------------------------------------ render

  /** One measure-and-paint pass. Safe to call as often as you like. */
  private render() {
    const step = this.step;
    if (!this.active || !step) return;

    // Wrong screen: hide the furniture and wait rather than pointing at nothing.
    if (step.screen !== 'ANY' && step.screen !== this.currentScreen) {
      this.park();
      return;
    }

    const target = document.querySelector(step.selector);
    if (!target) {
      // The element may simply not be rendered yet — the game rebuilds containers
      // constantly. Park briefly, then skip so a bad selector cannot wedge the run.
      this.park();
      if (Date.now() - this.waitingSince > RESOLVE_TIMEOUT_MS) {
        console.warn(`[Tutorial] "${step.selector}" never appeared, skipping step`);
        this.next();
      }
      return;
    }

    // Scroll before measuring. Doing it the other way round paints the first frame at the
    // element's pre-scroll position and relies on the next animation frame to correct it —
    // which never arrives if rAF is throttled.
    if (target !== this.lastTarget) {
      this.ensureVisible(target);
      this.bindAction(target, step);
      this.lastTarget = target;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      this.park();
      return;
    }

    this.root.classList.remove('waiting');
    this.paintSpotlight(rect);
    this.paintTooltip(rect, step);
  }

  private park() {
    this.root.classList.add('waiting');
  }

  /** Keeps the cutout glued to a target that moves, resizes or gets rebuilt. */
  private loop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const tick = () => {
      if (!this.active) return;
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private paintSpotlight(rect: DOMRect) {
    const x = Math.max(0, rect.left - PADDING);
    const y = Math.max(0, rect.top - PADDING);
    const w = Math.min(window.innerWidth - x, rect.width + PADDING * 2);
    const h = Math.min(window.innerHeight - y, rect.height + PADDING * 2);

    this.spotlight.style.transform = `translate(${x}px, ${y}px)`;
    this.spotlight.style.width = `${w}px`;
    this.spotlight.style.height = `${h}px`;
  }

  private paintTooltip(rect: DOMRect, step: TutorialStep) {
    this.tooltipText.innerText = step.text;
    this.tooltipCounter.innerText = `${this.index + 1} / ${this.steps.length}`;

    const wantsClick = step.actionRequired === 'click';
    this.btnNext.style.display = wantsClick || step.waitFor ? 'none' : 'inline-flex';
    this.tooltip.classList.toggle('awaiting-action', wantsClick);

    const tipW = Math.min(TOOLTIP_WIDTH, window.innerWidth - 24);
    this.tooltip.style.width = `${tipW}px`;
    const tipH = this.tooltip.offsetHeight || 140;

    // Start from the requested side, then flip if there is no room for it.
    let side = step.position ?? 'bottom';
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (side === 'top' && spaceAbove < tipH + TOOLTIP_GAP) side = 'bottom';
    else if (side === 'bottom' && spaceBelow < tipH + TOOLTIP_GAP) side = 'top';

    let top: number;
    if (side === 'top') top = rect.top - tipH - TOOLTIP_GAP;
    else top = rect.bottom + TOOLTIP_GAP;

    // Centre on the target, then pull back inside the viewport.
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - tipH - 12));

    this.tooltip.style.transform = `translate(${left}px, ${top}px)`;
    this.tooltip.dataset.side = side;

    // The arrow tracks the target even when the tooltip has been nudged sideways.
    const arrowX = Math.max(16, Math.min(rect.left + rect.width / 2 - left, tipW - 16));
    this.arrow.style.left = `${arrowX}px`;
  }

  // ------------------------------------------------------------------ actions

  /**
   * Brings the target inside the viewport. On a phone the header controls and the hand
   * both live in horizontal scrollers, so the element a step points at is often parked
   * off-screen — highlighting it there would spotlight empty space.
   *
   * Only runs when the target changes, never per frame, so it cannot fight the player.
   */
  private ensureVisible(target: Element) {
    const r = target.getBoundingClientRect();
    const offscreen =
      r.left < 0 || r.top < 0 ||
      r.right > window.innerWidth || r.bottom > window.innerHeight;

    if (offscreen) {
      // Instant, not smooth: a smooth scroll is driven by the compositor, so a throttled
      // or backgrounded tab leaves it half-finished and the spotlight lands on nothing.
      target.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    }
  }

  /**
   * Wires the "player must click this" case. The listener goes on the element for this
   * frame only — it is re-bound whenever the node is replaced, which the render loop
   * detects by identity.
   */
  private bindAction(target: Element, step: TutorialStep) {
    // Always drop the previous one first. A run that was skipped or restarted would
    // otherwise leave a live listener behind, and the next run would advance twice.
    this.clearAction();
    if (step.actionRequired !== 'click') return;

    const handler = () => {
      this.clearAction();
      // Let the game handle its own click first, then move on.
      setTimeout(() => this.next(), 0);
    };
    target.addEventListener('click', handler);
    this.actionCleanup = () => target.removeEventListener('click', handler);
  }

  private clearAction() {
    if (this.actionCleanup) {
      this.actionCleanup();
      this.actionCleanup = null;
    }
  }

  /** Polls a step's own completion condition; used for "win the duel" style steps. */
  private checkWaitFor() {
    const step = this.step;
    if (step?.waitFor && step.waitFor()) this.next();
  }

  // ---------------------------------------------------------------------- dom

  /**
   * Labels the tooltip's own controls. Not done in buildDom: the manager is constructed at
   * import time, long before the platform reports a language, so text baked in there would
   * be Russian for everyone. start() only runs on a click, by which point the language is
   * settled — and re-labelling three nodes costs nothing.
   */
  private applyChrome() {
    this.btnSkip.innerText = t('tutorial.skip');
    this.btnNext.innerText = t('tutorial.next');
    const hint = this.root.querySelector<HTMLElement>('.tutorial-hint');
    if (hint) hint.innerText = t('tutorial.clickHint');
  }

  private buildDom() {
    this.root = document.createElement('div');
    this.root.className = 'tutorial-root';
    this.root.innerHTML = `
      <div class="tutorial-spotlight"></div>
      <div class="tutorial-tooltip">
        <div class="tutorial-arrow"></div>
        <div class="tutorial-body">
          <p class="tutorial-text"></p>
          <div class="tutorial-footer">
            <span class="tutorial-counter"></span>
            <div class="tutorial-actions">
              <button class="tutorial-skip" type="button"></button>
              <button class="tutorial-next" type="button"></button>
            </div>
          </div>
          <div class="tutorial-hint"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.root);

    this.spotlight = this.root.querySelector('.tutorial-spotlight')!;
    this.tooltip = this.root.querySelector('.tutorial-tooltip')!;
    this.tooltipText = this.root.querySelector('.tutorial-text')!;
    this.tooltipCounter = this.root.querySelector('.tutorial-counter')!;
    this.arrow = this.root.querySelector('.tutorial-arrow')!;
    this.btnNext = this.root.querySelector('.tutorial-next')!;
    this.btnSkip = this.root.querySelector('.tutorial-skip')!;

    this.btnNext.addEventListener('click', () => this.next());
    this.btnSkip.addEventListener('click', () => this.stop(false));

    window.addEventListener('resize', () => this.render());
    // Cheap poll for waitFor steps; the raf loop handles everything positional.
    setInterval(() => { if (this.active) this.checkWaitFor(); }, 250);
  }
}

export const tutorial = new TutorialManager();
