// Warms the browser image cache for item icons before the first hand is dealt,
// so cards paint instantly instead of popping in mid-battle.
//
// The art is already exported at render size by scripts/optimize-images.mjs, so there is
// nothing to downscale here — decoding ahead of time is the whole job.

import { ALL_ITEMS } from '../game/ItemCatalog';

class ImagePreloaderEngine {
  private preloadedImages: Record<string, HTMLImageElement> = {};
  public isReady: boolean = false;

  public async preloadAll(): Promise<void> {
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
