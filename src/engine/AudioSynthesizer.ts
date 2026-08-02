// Web Audio & File-based Sound Engine for Dealer's Gambit
// Plays real MP3/WAV audio files from /public/sounds/ with synthesized fallbacks

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private audioCache: Record<string, HTMLAudioElement> = {};
  public isMuted: boolean = false;

  constructor() {
    // Preload audio files if present
    this.preloadFile('shot', '/sounds/shot.mp3');
    this.preloadFile('blank', '/sounds/blank.mp3');
    this.preloadFile('reload', '/sounds/reload.mp3');
    this.preloadFile('card_deal', '/sounds/card_deal.mp3');
    this.preloadFile('card_use', '/sounds/card_use.mp3');
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  private init() {
    if (this.isMuted) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private preloadFile(key: string, url: string) {
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';
    this.audioCache[key] = audio;
  }

  private playCustomFile(key: string): boolean {
    if (this.isMuted) return true;
    const audio = this.audioCache[key];
    if (audio && audio.readyState >= 2) {
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.currentTime = 0;
      clone.volume = 0.85;
      clone.play().catch(() => {});
      return true;
    }
    return false;
  }

  // Play Revolver Cylinder Reload / Spin Sound
  playReload() {
    if (this.playCustomFile('reload')) return;
    this.playClick();
  }

  // Play Revolver Click / Spin
  playClick() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.035);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  // Play Card Slide / Deal
  playCardSlide() {
    if (this.playCustomFile('card_deal')) return;

    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.09;
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
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Play Gunshot (Live Round)
  playLiveShot() {
    if (this.playCustomFile('shot')) return;

    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Transient Crack
    const noiseLen = this.ctx.sampleRate * 0.28;
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
    noiseGain.gain.setValueAtTime(0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    // Sub-Bass Thud
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(220, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.35);

    subGain.gain.setValueAtTime(0.7, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    noise.start(now);
    subOsc.start(now);
    subOsc.stop(now + 0.35);
  }

  // Play Blank Click (Misfire)
  playBlankClick() {
    if (this.playCustomFile('blank')) return;

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
    if (this.playCustomFile('card_use')) return;

    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.06;
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
