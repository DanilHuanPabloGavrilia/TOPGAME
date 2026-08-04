// Web Audio & File-based High-Performance Sound Engine for Dealer's Gambit
// Pre-decodes MP3 files into Web Audio API AudioBuffers for 0ms latency synchronous playback

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private audioBuffers: Record<string, AudioBuffer> = {};
  private audioPool: Record<string, HTMLAudioElement[]> = {};
  private activeReloadSources: (AudioBufferSourceNode | HTMLAudioElement)[] = [];
  public isMuted: boolean = false;

  private soundFiles: Record<string, string> = {
    shot: '/sounds/shot.mp3',
    blank: '/sounds/blank.mp3',
    reload: '/sounds/reload.mp3',
    card_deal: '/sounds/card_deal.mp3',
    card_use: '/sounds/card_use.mp3'
  };

  constructor() {
    // Unlock AudioContext on first user interaction
    const unlock = () => {
      this.init();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);

    // Preload HTML5 Audio fallback pool
    Object.entries(this.soundFiles).forEach(([key, url]) => {
      this.audioPool[key] = Array.from({ length: 4 }, () => {
        const a = new Audio(url);
        a.preload = 'auto';
        return a;
      });
    });
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.loadAudioBuffers();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private async loadAudioBuffers() {
    if (!this.ctx) return;
    for (const [key, url] of Object.entries(this.soundFiles)) {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        if (this.ctx) {
          const decoded = await this.ctx.decodeAudioData(arrayBuffer);
          this.audioBuffers[key] = decoded;
        }
      } catch (e) {
        console.warn(`Failed to decode audio buffer for ${key}`, e);
      }
    }
  }

  public stopReload() {
    this.activeReloadSources.forEach(src => {
      try {
        if ('stop' in src) {
          (src as AudioBufferSourceNode).stop();
        } else if ('pause' in src) {
          (src as HTMLAudioElement).pause();
          (src as HTMLAudioElement).currentTime = 0;
        }
      } catch (e) {}
    });
    this.activeReloadSources = [];
  }

  private playBufferOrFallback(key: string, volume: number = 0.85): boolean {
    if (this.isMuted) return true;
    this.init();

    // 1. Instant 0ms latency Web Audio API AudioBuffer playback
    if (this.ctx && this.audioBuffers[key]) {
      try {
        const source = this.ctx.createBufferSource();
        const gainNode = this.ctx.createGain();
        source.buffer = this.audioBuffers[key];
        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);

        if (key === 'reload') {
          this.activeReloadSources.push(source);
        }
        return true;
      } catch (e) {
        console.warn('Web Audio buffer playback error:', e);
      }
    }

    // 2. Pre-allocated HTMLAudioElement Pool fallback
    const pool = this.audioPool[key];
    if (pool && pool.length > 0) {
      const available = pool.find(a => a.paused || a.ended) || pool[0];
      if (available) {
        available.currentTime = 0;
        available.volume = volume;
        available.play().catch(() => {});
        if (key === 'reload') {
          this.activeReloadSources.push(available);
        }
        return true;
      }
    }

    return false;
  }

  // Play Revolver Cylinder Reload / Spin Sound
  playReload() {
    this.stopReload();
    if (this.playBufferOrFallback('reload', 0.8)) return;
    this.playClick();
  }

  // Play Revolver Click / Spin
  playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.035);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  // Play Card Slide / Deal Sound
  playCardSlide() {
    if (this.playBufferOrFallback('card_deal', 0.9)) return;

    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.09);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.09);
    filter.Q.value = 2.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Play Gunshot (Live Round) — Instantly stops any playing cylinder spin sound!
  playLiveShot() {
    this.stopReload();

    if (this.playBufferOrFallback('shot', 0.95)) return;

    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const noiseLen = Math.floor(this.ctx.sampleRate * 0.28);
    const buffer = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(4500, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 0.28);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(220, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.35);

    subGain.gain.setValueAtTime(0.75, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    noise.start(now);
    subOsc.start(now);
    subOsc.stop(now + 0.35);
  }

  // Play Blank Click (Misfire) — Instantly stops any playing cylinder spin sound!
  playBlankClick() {
    this.stopReload();

    if (this.playBufferOrFallback('blank', 0.85)) return;

    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const pinOsc = this.ctx.createOscillator();
    const pinGain = this.ctx.createGain();
    pinOsc.type = 'triangle';
    pinOsc.frequency.setValueAtTime(2400, now);
    pinOsc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    pinGain.gain.setValueAtTime(0.4, now);
    pinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    pinOsc.connect(pinGain);
    pinGain.connect(this.ctx.destination);

    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(750, now);
    clickOsc.frequency.exponentialRampToValueAtTime(180, now + 0.05);

    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);

    pinOsc.start(now);
    pinOsc.stop(now + 0.03);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);
  }

  // Play Card Item Use Sound
  playItemPowerup() {
    if (this.playBufferOrFallback('card_use', 0.9)) return;

    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const snapNoise = this.ctx.createBufferSource();
    snapNoise.buffer = buffer;

    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.setValueAtTime(1500, now);

    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.2, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    snapNoise.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    snapNoise.start(now);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Play Coin Chime
  playCoinChime() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now);
    osc2.frequency.setValueAtTime(1318.51, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.1);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.2);
  }
}

export const sound = new AudioSynthesizer();
