/**
 * Single source of truth for league identity.
 *
 * The name below is a PLACEHOLDER. When the real name is chosen, change `name`,
 * `shortName`, and `wordmark` here and the whole frontend follows — that is the entire
 * point of this module.
 *
 * Two brand touchpoints deliberately live outside this file because they are backend or
 * data changes, not frontend ones:
 *   - Email templates and the `from:` name in functions/index.js
 *   - The `LOL-` invitation code prefix in services/firestoreService.ts, which would write
 *     new-format codes into production data. Existing codes stay valid regardless.
 * Both are a short follow-up once the real name lands.
 *
 * Note on terminology: "lights out" is the F1 term for a race start. The label on the
 * Schedule page and the easter egg's start sequence use it in that sense and are NOT
 * branding — they stay as they are whatever this league ends up being called.
 */
export const BRAND = {
  /** Full name. Used in titles, manifest, copyright. */
  name: 'Apex League',
  /** Compact name for tight spaces like the mobile header. */
  shortName: 'Apex',
  /** Wordmark lines, stacked in the hero and red-flag screens. */
  wordmark: ['APEX', 'LEAGUE'] as const,
  tagline: 'F1 Fantasy League',
  themeColor: '#DA291C',
} as const;

/** e.g. "Apex League © 2026" */
export const copyright = (year: number = new Date().getFullYear()): string =>
  `${BRAND.name} © ${year}`;
