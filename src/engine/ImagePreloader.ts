// Warms the browser image cache before the art is needed, so pictures paint with the
// screen instead of popping in a moment later.
//
// The art is already exported at render size by scripts/optimize-images.mjs, so there is
// nothing to downscale here — fetching and decoding ahead of time is the whole job.

import { ALL_ITEMS } from '../game/ItemCatalog';
import { LOCATIONS, TRAINING_BOSS } from '../game/BossCatalog';

class ImagePreloaderEngine {
  private preloadedImages: Record<string, HTMLImageElement> = {};
  public isReady: boolean = false;

  public async preloadAll(): Promise<void> {
    // Bosses first, and deliberately. The world map is the first screen with pictures on
    // it and it asks for fifteen of them at once — measured, none of the fifteen were
    // ready at the moment the map rendered, so every portrait arrived after its circle.
    // Item icons are not needed until a hand is dealt, which is at least one screen later.
    //
    // avatarUrl is read straight off the catalogue rather than through localizedBoss: the
    // catalogue stores keys for the text but the image is a static import either way, and
    // preloading has no business waiting on a language.
    const bosses = [...LOCATIONS.flatMap(loc => loc.bosses), TRAINING_BOSS];
    await Promise.all(bosses.map(boss => this.preload(`boss:${boss.id}`, boss.avatarUrl || '')));

    const items = Object.values(ALL_ITEMS);
    await Promise.all(items.map(item => this.preload(item.id, item.iconUrl || '')));
    this.isReady = true;
  }

  private preload(id: string, url: string): Promise<void> {
    if (!url) return Promise.resolve();

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.preloadedImages[id] = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  public getItemImage(_id: string, defaultUrl: string): string {
    return defaultUrl;
  }
}

export const imagePreloader = new ImagePreloaderEngine();
