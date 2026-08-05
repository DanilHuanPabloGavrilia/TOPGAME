// Progress persistence: localStorage always, platform cloud storage on top when available.
//
// localStorage is the fast, synchronous path and the only one that exists on the open web.
// Yandex/VK storage survives a cleared cache and follows the player across devices, but it
// is async and rate limited — so writes are debounced and the local copy is written first.

import type { SaveData } from '../game/SaveData';
import { platformSDK } from './PlatformSDK';

const STORAGE_KEY = 'dealers_gambit_save_v1';
const DEBOUNCE_MS = 1500;

class SaveManager {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: SaveData | null = null;

  constructor() {
    // A backgrounded tab may never come back, so flush before the browser lets go.
    // 'pagehide' fires on mobile Safari where 'beforeunload' does not.
    const flush = () => this.flush();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  /** Queues a save. Repeated calls inside the debounce window collapse into one write. */
  queue(data: SaveData): void {
    this.pending = data;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  /** Writes any queued save immediately. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.pending) return;

    const data = this.pending;
    this.pending = null;

    this.writeLocal(data);
    // Deliberately not awaited: the local write already happened, and a slow or failed
    // cloud round-trip must never block the game loop.
    void platformSDK.saveToCloud(data);
  }

  private writeLocal(data: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Private mode, disabled storage, or quota — the cloud copy may still get through.
      console.warn('[Save] localStorage write failed', err);
    }
  }

  private readLocal(): SaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch (err) {
      console.warn('[Save] localStorage read failed', err);
      return null;
    }
  }

  /**
   * Loads the best available save. When local and cloud disagree the higher saveCounter
   * wins — a player who cleared their cache keeps cloud progress, and one who played
   * offline since keeps that. Ties go to the cloud, which is the durable copy.
   */
  async load(): Promise<SaveData | null> {
    const local = this.readLocal();
    const cloud = platformSDK.hasCloudStorage() ? await platformSDK.loadFromCloud() : null;

    if (!cloud || typeof cloud.saveCounter !== 'number') return local;
    if (!local) return cloud as SaveData;

    return cloud.saveCounter >= local.saveCounter ? (cloud as SaveData) : local;
  }

  /** Drops all stored progress on both tiers. */
  async clear(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to do — the key was unreachable anyway
    }
    await platformSDK.saveToCloud({});
  }
}

export const saveManager = new SaveManager();
