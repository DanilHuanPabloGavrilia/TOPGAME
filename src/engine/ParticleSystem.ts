// Shot effect art. Pulled in with import.meta.glob rather than a static import so that a
// master which has not been delivered yet cannot fail the build — the beam and the blank
// burst arrive as separate art drops. Glob URLs are rewritten against Vite's `base` exactly
// like the static imports in the catalogues, so the platform subdirectory still resolves.
const FX_ART = import.meta.glob('../assets/images/fx/*.webp', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

function loadFxArt(name: string): HTMLImageElement | null {
  const path = Object.keys(FX_ART).find(k => k.endsWith(`/${name}.webp`));
  if (!path) return null;
  // No decode callback needed: the fetch starts at module load and the first shot of a duel
  // is many seconds later. `ready()` covers the case where it somehow is not.
  const img = new Image();
  img.src = FX_ART[path];
  return img;
}

const beamArt = loadFxArt('shot-beam');
const blankArt = loadFxArt('blank-burst');

function ready(img: HTMLImageElement | null): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0;
}

/**
 * How much of the beam master is muzzle flash rather than beam. Only this slice is blitted;
 * see drawMuzzleFlash for why the rest is drawn as a stroke instead.
 */
const FLASH_SLICE = 0.34;

// Three strokes of decreasing width, added on top of each other. The wide one is the halo,
// the narrow one the white core — a single stroke of any width gives you one or the other.
const BEAM_PASSES = [
  { width: 18, alpha: 0.16 },
  { width: 8, alpha: 0.38 },
  { width: 2.5, alpha: 0.95 }
];

/** BEAM crosses the table, FLASH is a live round with nowhere to travel, BLANK is a misfire. */
type ShotFxKind = 'BEAM' | 'FLASH' | 'BLANK';

export interface ShotFx {
  kind: ShotFxKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  scale: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private ambientEmbers: Particle[] = [];
  private shots: ShotFx[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initAmbientEmbers();
    this.animate();
  }

  resize() {
    this.canvas.width = this.canvas.parentElement?.clientWidth || window.innerWidth;
    this.canvas.height = this.canvas.parentElement?.clientHeight || window.innerHeight;
  }

  initAmbientEmbers() {
    for (let i = 0; i < 25; i++) {
      this.ambientEmbers.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.4 - 0.1,
        size: Math.random() * 2 + 1,
        color: Math.random() > 0.5 ? '#05d9e8' : '#ff2a6d',
        alpha: Math.random() * 0.5 + 0.1,
        life: 0,
        maxLife: 500
      });
    }
  }

  spawnBurst(x: number, y: number, color: string, count = 35) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 40 + 20
      });
    }
  }

  spawnFloatingText(text: string, x: number, y: number, color: string) {
    this.floatingTexts.push({
      id: Date.now() + Math.random(),
      text,
      x,
      y,
      color,
      scale: 1.5,
      alpha: 1,
      life: 0,
      maxLife: 60
    });
  }

  /**
   * Fires the shot effect. Coordinates are viewport pixels, same as spawnBurst — the canvas
   * is pinned to the top-left of #app at full size, so the two spaces coincide.
   */
  spawnShot(kind: ShotFxKind, x1: number, y1: number, x2: number = x1, y2: number = y1) {
    this.shots.push({ kind, x1, y1, x2, y2, life: 0, maxLife: kind === 'BEAM' ? 15 : 20 });
    // A shot only ages on the frames it is drawn, and a backgrounded tab suspends the frame
    // loop while the dealer's turn timer keeps firing — so the queue can fill with rounds
    // that all then arrive on the same frame. Additively that is one white slab across the
    // screen. Two in flight is already more than a duel ever needs.
    if (this.shots.length > 2) this.shots.splice(0, this.shots.length - 2);
  }

  private drawShots() {
    const ctx = this.ctx;

    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life++;

      if (s.life >= s.maxLife) {
        this.shots.splice(i, 1);
        continue;
      }

      // Held at full strength for the first third, then faded. A bolt that starts dimming on
      // frame one never reads as having been there at all.
      const p = s.life / s.maxLife;
      const alpha = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;

      ctx.save();
      // Additive. The masters sit on black and black adds nothing, which is what makes the
      // background-removal step unnecessary rather than merely optional: cutting an alpha
      // channel out of a glow eats the soft falloff that makes it read as light.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;

      if (s.kind === 'BEAM') {
        this.drawBeam(s, p, alpha);
      } else if (s.kind === 'FLASH') {
        // Pointed up and away rather than along any axis: the barrel is under a chin, and a
        // horizontal discharge would read as a shot at whoever is off to the side.
        this.drawMuzzleFlash(s.x1, s.y1, 1.4 - p * 0.3, -Math.PI / 2);
      } else {
        this.drawBlankBurst(s.x1, s.y1, 0.8 + p * 0.5);
      }

      ctx.restore();
    }
  }

  private drawBeam(s: ShotFx, p: number, alpha: number) {
    const ctx = this.ctx;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;

    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(s.x1, s.y1);
    ctx.rotate(angle);

    // Palette read off the master: white at the muzzle, magenta through the first third,
    // cyan by the time it arrives.
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.08, '#ff6ad5');
    grad.addColorStop(0.4, '#b06aff');
    grad.addColorStop(1, '#7df9ff');

    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';

    // Fat on impact, thinning as it fades. The swell is what sells it as a discharge rather
    // than a line someone drew.
    const swell = 1.25 - p * 0.75;
    for (const pass of BEAM_PASSES) {
      ctx.globalAlpha = alpha * pass.alpha;
      ctx.lineWidth = pass.width * swell;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalAlpha = alpha;
    this.drawMuzzleFlash(s.x1, s.y1, 1.15 - p * 0.25, angle);
    this.drawImpact(s.x2, s.y2, 1 - p * 0.4);
  }

  private drawMuzzleFlash(x: number, y: number, scale: number, angle: number) {
    const ctx = this.ctx;

    if (ready(beamArt)) {
      // Only the muzzle end of the master goes on screen. The long tail of that artwork is
      // the beam itself, and the distance it has to cross changes with the layout — one
      // sprite stretched to fit would smear the flash along with the beam. So the tail is a
      // stroke (above) and this sprite is never scaled by distance.
      const sw = beamArt.naturalWidth * FLASH_SLICE;
      const sh = beamArt.naturalHeight;
      const dh = 170 * scale;
      const dw = dh * (sw / sh);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.drawImage(beamArt, 0, 0, sw, sh, -dw * 0.42, -dh / 2, dw, dh);
      ctx.restore();
    }

    // Drawn under the sprite, not only in place of it: the core keeps the muzzle white-hot at
    // any scale, and it carries the whole effect until the beam master lands.
    const r = 38 * scale;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    g.addColorStop(0.3, 'rgba(255, 106, 213, 0.55)');
    g.addColorStop(1, 'rgba(255, 42, 109, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawImpact(x: number, y: number, scale: number) {
    const ctx = this.ctx;
    const r = 46 * scale;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    g.addColorStop(0.35, 'rgba(125, 249, 255, 0.45)');
    g.addColorStop(1, 'rgba(5, 217, 232, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBlankBurst(x: number, y: number, scale: number) {
    const ctx = this.ctx;

    if (ready(blankArt)) {
      // Deliberately smaller than the live flash. A blank is the round where nothing
      // happened, and an effect the size of a hit would be the interface telling a lie.
      const dw = 170 * scale;
      const dh = dw * (blankArt.naturalHeight / blankArt.naturalWidth);
      ctx.drawImage(blankArt, x - dw / 2, y - dh / 2, dw, dh);
      return;
    }

    const r = 40 * scale;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    g.addColorStop(0.4, 'rgba(5, 217, 232, 0.4)');
    g.addColorStop(1, 'rgba(5, 217, 232, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private animate = () => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Ambient Embers
    for (let i = 0; i < this.ambientEmbers.length; i++) {
      const e = this.ambientEmbers[i];
      e.x += e.vx;
      e.y += e.vy;
      if (e.y < 0) e.y = this.canvas.height;
      if (e.x < 0) e.x = this.canvas.width;
      if (e.x > this.canvas.width) e.x = 0;

      this.ctx.save();
      this.ctx.globalAlpha = e.alpha;
      this.ctx.fillStyle = e.color;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = e.color;
      this.ctx.beginPath();
      this.ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 2. Draw Burst Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.life++;
      p.alpha = 1 - p.life / p.maxLife;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 3. Draw Shot FX — under the damage numbers, which must stay readable through a flash
    this.drawShots();

    // 4. Draw Bouncing Floating Damage & Bonus Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.5; // Float upwards
      ft.life++;
      ft.alpha = 1 - ft.life / ft.maxLife;

      if (ft.life < 10) {
        ft.scale = 1 + (10 - ft.life) * 0.05; // Bounce pop
      } else {
        ft.scale = 1;
      }

      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, ft.alpha);
      this.ctx.font = `900 ${Math.round(26 * ft.scale)}px 'Orbitron', sans-serif`;
      this.ctx.fillStyle = ft.color;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = ft.color;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();
    }

    requestAnimationFrame(this.animate);
  };
}
