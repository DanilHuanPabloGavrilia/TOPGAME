// Platform SDK Manager for Yandex Games SDK v2 & VK Direct Games (VK Bridge)

declare global {
  interface Window {
    YaGames?: any;
    vkBridge?: any;
  }
}

class PlatformSDK {
  public platform: 'YANDEX' | 'VK' | 'LOCAL' = 'LOCAL';
  private ysdk: any = null;
  private isInitialized = false;
  private isAdShowing = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Try VK Bridge first
    if (window.vkBridge) {
      try {
        await window.vkBridge.send('VKWebAppInit');
        this.platform = 'VK';
        this.isInitialized = true;
        console.log('[SDK] VK Bridge Initialized');
        return;
      } catch (err) {
        console.warn('[SDK] VK Bridge init failed, checking Yandex Games...', err);
      }
    }

    // Try Yandex Games SDK
    if (window.YaGames) {
      try {
        this.ysdk = await window.YaGames.init();
        this.platform = 'YANDEX';
        this.isInitialized = true;
        console.log('[SDK] Yandex Games SDK Initialized');

        if (this.ysdk.features?.LoadingAPI?.ready) {
          this.ysdk.features.LoadingAPI.ready();
        }
        return;
      } catch (err) {
        console.warn('[SDK] Yandex Games init failed, fallback to local', err);
      }
    }

    this.platform = 'LOCAL';
    this.isInitialized = true;
    console.log('[SDK] Running in Local / Standalone Web Mode');
  }

  public getIsAdShowing(): boolean {
    return this.isAdShowing;
  }

  showRewardedVideo(onSuccess: () => void, onError?: () => void): void {
    if (this.isAdShowing) {
      console.warn('[SDK] Ad is already showing! Ignoring duplicate call.');
      if (onError) onError();
      return;
    }

    if (this.platform === 'YANDEX' && this.ysdk) {
      this.isAdShowing = true;
      try {
        this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => console.log('[SDK] Rewarded Video Opened'),
            onRewarded: () => {
              console.log('[SDK] Rewarded Video Granted');
              onSuccess();
            },
            onClose: () => {
              console.log('[SDK] Rewarded Video Closed');
              this.isAdShowing = false;
            },
            onError: (e: any) => {
              console.error('[SDK] Rewarded Video Error:', e);
              this.isAdShowing = false;
              if (onError) onError();
            },
            onOffline: () => {
              console.warn('[SDK] Rewarded Video Offline');
              this.isAdShowing = false;
              if (onError) onError();
            }
          }
        });
      } catch (err) {
        console.error('[SDK] Rewarded Video Exception:', err);
        this.isAdShowing = false;
        if (onError) onError();
      }
    } else if (this.platform === 'VK' && window.vkBridge) {
      this.isAdShowing = true;
      window.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
        .then((data: any) => {
          this.isAdShowing = false;
          if (data.result) onSuccess();
          else if (onError) onError();
        })
        .catch((e: any) => {
          console.error('[SDK] VK Rewarded Error:', e);
          this.isAdShowing = false;
          if (onError) onError();
        });
    } else {
      // Local fallback (Simulated instant reward for testing)
      onSuccess();
    }
  }

  showInterstitialAd(onComplete?: () => void): void {
    if (this.isAdShowing) {
      console.warn('[SDK] Ad is already showing! Skipping interstitial.');
      if (onComplete) onComplete();
      return;
    }

    if (this.platform === 'YANDEX' && this.ysdk) {
      this.isAdShowing = true;
      try {
        this.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => console.log('[SDK] Fullscreen Ad Opened'),
            onClose: (wasShown: boolean) => {
              console.log('[SDK] Fullscreen Ad Closed, wasShown:', wasShown);
              this.isAdShowing = false;
              if (onComplete) onComplete();
            },
            onError: (e: any) => {
              console.error('[SDK] Fullscreen Ad Error:', e);
              this.isAdShowing = false;
              if (onComplete) onComplete();
            },
            onOffline: () => {
              console.warn('[SDK] Fullscreen Ad Offline');
              this.isAdShowing = false;
              if (onComplete) onComplete();
            }
          }
        });
      } catch (err) {
        console.error('[SDK] Fullscreen Ad Exception:', err);
        this.isAdShowing = false;
        if (onComplete) onComplete();
      }
    } else if (this.platform === 'VK' && window.vkBridge) {
      this.isAdShowing = true;
      window.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
        .then(() => {
          this.isAdShowing = false;
          if (onComplete) onComplete();
        })
        .catch(() => {
          this.isAdShowing = false;
          if (onComplete) onComplete();
        });
    } else {
      if (onComplete) onComplete();
    }
  }
}

export const platformSDK = new PlatformSDK();
