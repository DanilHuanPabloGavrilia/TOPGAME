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

    // 3. Draw Bouncing Floating Damage & Bonus Text
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
