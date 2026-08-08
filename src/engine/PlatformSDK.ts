// Platform SDK Manager for Yandex Games SDK v2 & VK Direct Games (VK Bridge)
//
// The Yandex SDK must be loaded from yandex.ru — their platform requires it and it cannot
// be bundled. vk-bridge is an npm dependency, imported dynamically only when the page is
// actually running inside VK, so a Yandex or standalone build never downloads it.

declare global {
  interface Window {
    YaGames?: any;
  }
}

/** VK Mini Apps / Direct Games always hand the frame a vk_app_id parameter. */
function isVkContext(): boolean {
  try {
    const query = location.search || location.hash.replace(/^#/, '');
    return new URLSearchParams(query).has('vk_app_id');
  } catch {
    return false;
  }
}

/**
 * Yandex and VK always run a game inside their own frame. A top-level window means a dev
 * server or a build opened directly — and there YaGames.init() still resolves while every
 * ad call silently does nothing, which would make ad-gated features untestable.
 */
function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent throws on access, which itself proves we are framed.
    return true;
  }
}

// Yandex insists their SDK be served from their own domain, so it cannot be bundled. It is
// injected here rather than sat in index.html as a blocking tag: on VK and abroad yandex.ru
// is slow or unreachable, and a tag in <head> would hold up first paint until it timed out.
const YANDEX_SDK_URL = 'https://yandex.ru/games/sdk/v2';

// Long enough for a cold CDN on a bad phone connection, short enough that a player never
// waits on a host that is simply not going to answer.
const SDK_LOAD_TIMEOUT_MS = 6000;

/**
 * Fetches the Yandex SDK. Resolves false — never rejects — when the script fails, times out
 * or loads without defining YaGames, so the caller can just fall through to standalone mode.
 */
function loadYandexSdk(): Promise<boolean> {
  if (window.YaGames) return Promise.resolve(true);

  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // onload can fire for a script that never defined the global — check, don't assume.
      resolve(ok && !!window.YaGames);
    };

    const timer = setTimeout(() => {
      console.warn('[SDK] Yandex SDK did not load within timeout, continuing without it');
      finish(false);
    }, SDK_LOAD_TIMEOUT_MS);

    const script = document.createElement('script');
    script.src = YANDEX_SDK_URL;
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });
}

// Key for VK's key/value storage. Yandex stores the blob as an unnamed player-data object.
const VK_STORAGE_KEY = 'dealers_gambit_save';

// How long to wait for an ad to report that it opened before assuming the SDK swallowed
// the call. Without this the "ad in progress" lock leaks and blocks every later ad.
const AD_OPEN_TIMEOUT_MS = 15000;

class PlatformSDK {
  public platform: 'YANDEX' | 'VK' | 'LOCAL' = 'LOCAL';
  private ysdk: any = null;
  private yPlayer: any = null;
  private vkBridge: any = null;
  private isInitialized = false;
  private isAdShowing = false;
  private adWatchdog: ReturnType<typeof setTimeout> | null = null;
  private gameplayRunning = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Try VK Bridge first
    if (isVkContext()) {
      try {
        const mod = await import('@vkontakte/vk-bridge');
        const bridge = mod.default;
        await bridge.send('VKWebAppInit');
        this.vkBridge = bridge;
        this.platform = 'VK';
        this.isInitialized = true;
        console.log('[SDK] VK Bridge Initialized');
        return;
      } catch (err) {
        console.warn('[SDK] VK Bridge init failed, checking Yandex Games...', err);
      }
    }

    // Try Yandex Games SDK. Gated on isFramed() so a standalone build, a VK frame that fell
    // through, or a local dev server never even requests yandex.ru.
    if (isFramed() && await loadYandexSdk()) {
      try {
        this.ysdk = await window.YaGames.init();
        this.platform = 'YANDEX';
        this.isInitialized = true;
        console.log('[SDK] Yandex Games SDK Initialized');

        // scopes:false returns a player handle without prompting to log in — anonymous
        // players still get durable cloud storage, which is what we need for saves.
        try {
          this.yPlayer = await this.ysdk.getPlayer({ scopes: false });
        } catch (err) {
          console.warn('[SDK] getPlayer failed, cloud saves disabled', err);
        }

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

  /**
   * Marks the stretches when the player is actually duelling. Yandex uses it to keep its own
   * interruptions out of live gameplay, and asks every game to report it.
   *
   * Both calls are idempotent — the render loop calls them on every repaint — and both are
   * no-ops off Yandex, where `ysdk` is null.
   */
  public gameplayStart(): void {
    if (this.gameplayRunning) return;
    this.gameplayRunning = true;
    try {
      this.ysdk?.features?.GameplayAPI?.start?.();
    } catch (err) {
      console.warn('[SDK] GameplayAPI.start failed', err);
    }
  }

  public gameplayStop(): void {
    if (!this.gameplayRunning) return;
    this.gameplayRunning = false;
    try {
      this.ysdk?.features?.GameplayAPI?.stop?.();
    } catch (err) {
      console.warn('[SDK] GameplayAPI.stop failed', err);
    }
  }

  /**
   * The language the platform launched us in, as a raw locale tag — 'en', 'tr', 'kk-KZ'.
   * Yandex exposes it on the SDK; VK passes vk_language in the launch parameters, which is
   * why it is read from the URL rather than over the bridge. Null means "nobody told us",
   * and the caller falls back to the browser's own preference.
   */
  public getLanguage(): string | null {
    if (this.platform === 'YANDEX' && this.ysdk) {
      const lang = this.ysdk.environment?.i18n?.lang;
      if (typeof lang === 'string' && lang) return lang;
    }

    if (this.platform === 'VK') {
      try {
        const query = location.search || location.hash.replace(/^#/, '');
        const lang = new URLSearchParams(query).get('vk_language');
        if (lang) return lang;
      } catch {
        // Malformed launch URL — fall through to the browser preference.
      }
    }

    return null;
  }

  /**
   * Takes the "an ad is on screen" lock and arms a watchdog. If the SDK never reports that
   * the ad opened — throttled frame, unreachable ad network, a call it simply swallowed —
   * the lock is released instead of refusing every ad for the rest of the session.
   */
  private beginAd(onTimeout?: () => void): void {
    this.isAdShowing = true;
    // An ad on screen is not gameplay. The render loop restarts it once the player is back
    // in a duel, so nothing here has to remember to.
    this.gameplayStop();
    this.clearAdWatchdog();
    this.adWatchdog = setTimeout(() => {
      console.warn('[SDK] Ad never opened within timeout, releasing lock');
      this.adWatchdog = null;
      this.isAdShowing = false;
      if (onTimeout) onTimeout();
    }, AD_OPEN_TIMEOUT_MS);
  }

  /** The ad is genuinely on screen; its own close/error callback will release the lock. */
  private adOpened(): void {
    this.clearAdWatchdog();
  }

  private endAd(): void {
    this.clearAdWatchdog();
    this.isAdShowing = false;
  }

  private clearAdWatchdog(): void {
    if (this.adWatchdog) {
      clearTimeout(this.adWatchdog);
      this.adWatchdog = null;
    }
  }

  /** True when the platform offers storage that survives a cleared browser cache. */
  public hasCloudStorage(): boolean {
    return (this.platform === 'YANDEX' && !!this.yPlayer) || (this.platform === 'VK' && !!this.vkBridge);
  }

  /** Writes the save blob to platform storage. Resolves false if it did not land. */
  async saveToCloud(data: unknown): Promise<boolean> {
    try {
      if (this.platform === 'YANDEX' && this.yPlayer) {
        await this.yPlayer.setData(data, true);
        return true;
      }
      if (this.platform === 'VK' && this.vkBridge) {
        await this.vkBridge.send('VKWebAppStorageSet', {
          key: VK_STORAGE_KEY,
          value: JSON.stringify(data)
        });
        return true;
      }
    } catch (err) {
      console.warn('[SDK] Cloud save failed', err);
    }
    return false;
  }

  /** Reads the save blob from platform storage. Resolves null when absent or unreachable. */
  async loadFromCloud(): Promise<any | null> {
    try {
      if (this.platform === 'YANDEX' && this.yPlayer) {
        const data = await this.yPlayer.getData();
        return data && Object.keys(data).length > 0 ? data : null;
      }
      if (this.platform === 'VK' && this.vkBridge) {
        const res = await this.vkBridge.send('VKWebAppStorageGet', { keys: [VK_STORAGE_KEY] });
        const raw = res?.keys?.find((k: any) => k.key === VK_STORAGE_KEY)?.value;
        return raw ? JSON.parse(raw) : null;
      }
    } catch (err) {
      console.warn('[SDK] Cloud load failed', err);
    }
    return null;
  }

  showRewardedVideo(onSuccess: () => void, onError?: () => void): void {
    if (this.isAdShowing) {
      console.warn('[SDK] Ad is already showing! Ignoring duplicate call.');
      if (onError) onError();
      return;
    }

    if (this.platform === 'YANDEX' && this.ysdk) {
      this.beginAd(onError);
      try {
        this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {
              console.log('[SDK] Rewarded Video Opened');
              this.adOpened();
            },
            onRewarded: () => {
              console.log('[SDK] Rewarded Video Granted');
              onSuccess();
            },
            onClose: () => {
              console.log('[SDK] Rewarded Video Closed');
              this.endAd();
            },
            onError: (e: any) => {
              console.error('[SDK] Rewarded Video Error:', e);
              this.endAd();
              if (onError) onError();
            },
            onOffline: () => {
              console.warn('[SDK] Rewarded Video Offline');
              this.endAd();
              if (onError) onError();
            }
          }
        });
      } catch (err) {
        console.error('[SDK] Rewarded Video Exception:', err);
        this.endAd();
        if (onError) onError();
      }
    } else if (this.platform === 'VK' && this.vkBridge) {
      this.beginAd(onError);
      this.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
        .then((data: any) => {
          this.endAd();
          if (data.result) onSuccess();
          else if (onError) onError();
        })
        .catch((e: any) => {
          console.error('[SDK] VK Rewarded Error:', e);
          this.endAd();
          if (onError) onError();
        });
    } else {
      // No ad provider. In a dev build grant the reward anyway, otherwise every ad-gated
      // feature becomes untestable locally.
      //
      // In a shipped build, refuse. 'LOCAL' there does not mean "someone is developing" — it
      // means the SDK failed or timed out inside a real platform frame, and granting on that
      // path hands out unlimited free rewards to anyone who can make yandex.ru unreachable.
      if (import.meta.env.DEV) {
        onSuccess();
      } else {
        console.warn('[SDK] No ad provider available, reward refused');
        if (onError) onError();
      }
    }
  }

  showInterstitialAd(onComplete?: () => void): void {
    if (this.isAdShowing) {
      console.warn('[SDK] Ad is already showing! Skipping interstitial.');
      if (onComplete) onComplete();
      return;
    }

    if (this.platform === 'YANDEX' && this.ysdk) {
      this.beginAd(onComplete);
      try {
        this.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => {
              console.log('[SDK] Fullscreen Ad Opened');
              this.adOpened();
            },
            onClose: (wasShown: boolean) => {
              console.log('[SDK] Fullscreen Ad Closed, wasShown:', wasShown);
              this.endAd();
              if (onComplete) onComplete();
            },
            onError: (e: any) => {
              console.error('[SDK] Fullscreen Ad Error:', e);
              this.endAd();
              if (onComplete) onComplete();
            },
            onOffline: () => {
              console.warn('[SDK] Fullscreen Ad Offline');
              this.endAd();
              if (onComplete) onComplete();
            }
          }
        });
      } catch (err) {
        console.error('[SDK] Fullscreen Ad Exception:', err);
        this.endAd();
        if (onComplete) onComplete();
      }
    } else if (this.platform === 'VK' && this.vkBridge) {
      this.beginAd(onComplete);
      this.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
        .then(() => {
          this.endAd();
          if (onComplete) onComplete();
        })
        .catch(() => {
          this.endAd();
          if (onComplete) onComplete();
        });
    } else {
      if (onComplete) onComplete();
    }
  }
}

export const platformSDK = new PlatformSDK();
