// Platform SDK Manager for Yandex Games SDK v2 & VK Direct Games (VK Bridge)
//
// The Yandex SDK must be loaded from yandex.ru — their platform requires it and it cannot
// be bundled. vk-bridge is an npm dependency, imported dynamically only when the page is
// actually running inside VK, so a Yandex or standalone build never downloads it.

import { sound } from './AudioSynthesizer';

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

// The SDK used to be fetched from here. Requirement 1.19.1 rules that out: the script has
// to be connected the way the documentation shows it, with a tag in the markup, before
// YaGames.init() runs. It now lives in index.html and this module only consumes the global.
//
// What the tag does NOT decide is whether we then talk to it. Measured on the dev server:
// the tag loads fine off-platform, init() succeeds, platform flips to YANDEX — and every
// call after that throws "No parent to post message" in a loop, because the handshake has
// no parent frame to reach. Rewarded ads and GameplayAPI break, and the console fills.
// So the hostname gate survives, moved from loading to initialising: the script is loaded
// exactly as documented everywhere, and only a local host declines to shake hands with it.
// This matters beyond the dev server — the owner's playtest build runs the release bundle
// top-level on 127.0.0.1, where import.meta.env.DEV is false.
function isLocalHost(): boolean {
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
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
  private gameReadySent = false;

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

    // index.html carries the documented <script> tag, so by the time this runs window.YaGames
    // either exists or the request failed — nothing left to wait for. VK is skipped because
    // the bridge above is the integration there; a local host is skipped for the reason on
    // isLocalHost above.
    if (window.YaGames && !isVkContext() && !isLocalHost()) {
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

        // LoadingAPI.ready() deliberately does NOT fire here. See notifyGameReady().
        return;
      } catch (err) {
        console.warn('[SDK] Yandex Games init failed, fallback to local', err);
      }
    }

    this.platform = 'LOCAL';
    this.isInitialized = true;
    console.log('[SDK] Running in Local / Standalone Web Mode');
  }

  /**
   * Tells the platform the game is playable. Separate from init() on purpose.
   *
   * The documentation asks for this at the moment the game is genuinely ready: every
   * element interactive, no loading screen still on screen. Firing it from init() met
   * neither condition — the menu was painted straight out of index.html and clickable from
   * first paint, so the signal always trailed the first tap a player could make, and the
   * save had not been read yet, so the chip count and unlocked locations were still wrong.
   *
   * Idempotent: the caller sits at the end of boot(), which nothing should run twice, but a
   * second signal would be a protocol error rather than a no-op.
   */
  notifyGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;

    try {
      this.ysdk?.features?.LoadingAPI?.ready?.();
    } catch (err) {
      console.warn('[SDK] LoadingAPI.ready failed', err);
    }
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
    // The game must not talk over the ad's own audio. Suspension is separate from the
    // player's mute setting, so the sound button still reads the way they left it.
    sound.setSuspended(true);
    this.clearAdWatchdog();
    this.adWatchdog = setTimeout(() => {
      console.warn('[SDK] Ad never opened within timeout, releasing lock');
      this.adWatchdog = null;
      this.isAdShowing = false;
      // This path releases the lock without going through endAd(), so the sound has to be
      // let back in here too — otherwise an ad that never opened leaves the game mute.
      sound.setSuspended(false);
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
    sound.setSuspended(false);
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
