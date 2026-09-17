/**
 * Single source of truth for league identity.
 *
 * Change `name`, `shortName`, and `wordmark` here and the whole frontend follows — that is
 * the entire point of this module.
 *
 * Two brand touchpoints deliberately live outside this file because they are backend or
 * data changes, not frontend ones. Both already read "Lights Out League" and needed no
 * change when the frontend adopted the name:
 *   - Email templates and the `from:` name in functions/index.js
 *   - The `LOL-` invitation code prefix in services/firestoreService.ts
 *
 * Note on terminology: "lights out" is the F1 term for a race start. The label on the
 * Schedule page and the easter egg's start sequence use it in that sense, not as a
 * reference to the league name, so they are not driven by this module and should not be
 * rewritten to track it.
 */
export const BRAND = {
  /** Full name. Used in titles, manifest, copyright. */
  name: 'Lights Out League',
  /** Compact name for tight spaces like the mobile header. */
  shortName: 'Lights Out',
  /** Wordmark lines, stacked in the hero and red-flag screens. */
  wordmark: ['LIGHTS', 'OUT', 'LEAGUE'] as const,
  tagline: 'F1 Fantasy League',
  themeColor: '#DA291C',
} as const;

/** e.g. "Lights Out League © 2026" */
export const copyright = (year: number = new Date().getFullYear()): string =>
  `${BRAND.name} © ${year}`;
