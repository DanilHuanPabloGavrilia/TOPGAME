// Localization core.
//
// One flat dictionary per language, keyed by dotted strings. Russian is the source text and
// the fallback: a key missing from another language renders in Russian rather than as a raw
// key, so a half-finished translation degrades into a readable game instead of debug noise.
//
// The language is decided once, at boot, from the platform (Yandex i18n.lang / VK
// vk_language) and never changes mid-session — the platforms set it per launch.

import { ru } from './locales/ru';
import { en } from './locales/en';
import { tr } from './locales/tr';
import { kk } from './locales/kk';
import { uz } from './locales/uz';

export const LANGS = ['ru', 'en', 'tr', 'kk', 'uz'] as const;
export type Lang = (typeof LANGS)[number];

export type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Lang, Dictionary> = { ru, en, tr, kk, uz };

/** Russian is the source of truth; everything else falls back to it key by key. */
const FALLBACK: Lang = 'ru';

let current: Lang = FALLBACK;

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/**
 * Maps a platform locale onto one we ship. Handles 'en-US' style tags and the two scripts
 * Uzbek is written in ('uz-Latn', 'uz-Cyrl') — both get the same dictionary.
 */
export function normalizeLang(raw: string | null | undefined): Lang | null {
  if (!raw) return null;
  const base = raw.toLowerCase().split(/[-_]/)[0];
  return isLang(base) ? base : null;
}

export function setLang(lang: Lang): void {
  current = lang;
  // Assistive tech and the browser's own hyphenation both read this.
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function getLang(): Lang {
  return current;
}

/**
 * Looks up `key`, filling {placeholders} from `params`.
 *
 * An unknown key returns the key itself. That is deliberate: it is visible in testing and
 * greppable, where returning an empty string would silently blank part of the interface.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = DICTIONARIES[current][key] ?? DICTIONARIES[FALLBACK][key] ?? key;
  if (!params) return raw;

  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  );
}

/** Every key the source language defines — used by the coverage check in tests/tooling. */
export function sourceKeys(): string[] {
  return Object.keys(DICTIONARIES[FALLBACK]);
}

export function missingKeys(lang: Lang): string[] {
  const dict = DICTIONARIES[lang];
  return sourceKeys().filter(k => !(k in dict));
}
