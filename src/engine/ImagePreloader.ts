// In-Memory Asset Preloader & Image Resizer Engine for Dealer's Gambit
// Pre-decodes and downscales high-res item card images into 128x128 optimized RAM buffers for 0ms DOM rendering

import { ALL_ITEMS } from '../game/ItemCatalog';

class ImagePreloaderEngine {
  private cache: Record<string, string> = {};
  private preloadedImages: Record<string, HTMLImageElement> = {};
  public isReady: boolean = false;

  public async preloadAll(): Promise<void> {
    const items = Object.values(ALL_ITEMS);
    const loadPromises = items.map(item => this.loadAndOptimize(item.id, item.iconUrl || ''));

    try {
      await Promise.all(loadPromises);
      this.isReady = true;
    } catch (e) {
      console.warn('Preloader finished with warnings', e);
      this.isReady = true;
    }
  }

  private loadAndOptimize(id: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;

      img.onload = () => {
        try {
          // Downscale to 128x128 canvas
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, 128, 128);
            const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            this.cache[id] = optimizedDataUrl;
          } else {
            this.cache[id] = url;
          }
        } catch (e) {
          this.cache[id] = url;
        }
        this.preloadedImages[id] = img;
        resolve();
      };

      img.onerror = () => {
        this.cache[id] = url;
        resolve();
      };
    });
  }

  public getItemImage(id: string, defaultUrl: string): string {
    return this.cache[id] || defaultUrl;
  }
}

export const imagePreloader = new ImagePreloaderEngine();
