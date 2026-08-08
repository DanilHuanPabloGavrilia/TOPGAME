// Fills the static markup in index.html from the dictionaries.
//
// Everything the game draws at runtime goes through t() at the point of drawing. The
// markup that ships in index.html has no such moment, so it carries the key instead:
//
//   data-i18n="key"       → textContent, for plain strings
//   data-i18n-html="key"  → innerHTML, for the handful of guide paragraphs that mark up
//                           words with <strong>. The text comes from our own dictionaries
//                           and nothing outside them ever reaches this call.
//
// Only tag nodes nothing else writes to. A node the render loop fills — the dealer's name,
// the HP readouts, the modal body — is localized where it is written; tagging it here as
// well would give the same string two owners.
//
// The pass is idempotent on purpose. main.ts runs it twice: once with a provisional
// language so the first paint is never in the wrong one, and again if the platform
// disagrees once its SDK answers.

import { t } from './index';

export function applyStaticI18n(params: Record<string, string | number> = {}): void {
  document.title = t('ui.title');

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n!, params);
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml!, params);
  });
}
