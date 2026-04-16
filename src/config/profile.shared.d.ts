/**
 * Type declarations for profile.shared.mjs. The runtime values live in
 * the `.mjs` file (so they can be imported from the Node fetch script
 * without a build step); this file gives the Vue frontend proper types.
 *
 * Keep the literal types in sync with the values in profile.shared.mjs.
 */

export type SkillLevel = 'expert' | 'strong' | 'basic' | 'learning' | 'none';

export const SKILLS: {
  readonly vue: SkillLevel;
  readonly typescript: SkillLevel;
  readonly tailwind: SkillLevel;
  readonly pinia: SkillLevel;
  readonly capacitor_ionic: SkillLevel;
  readonly node: SkillLevel;
  readonly laravel: SkillLevel;
  readonly php: SkillLevel;
  readonly python: SkillLevel;
  readonly django: SkillLevel;
  readonly java: SkillLevel;
  readonly dotnet: SkillLevel;
  readonly nestjs: SkillLevel;
  readonly express: SkillLevel;
};

export const JSEARCH_QUERIES: ReadonlyArray<{
  readonly query: string;
  readonly country: string | null;
}>;

export const VUE_KEYWORDS: readonly string[];
export const LOCATION_BLOCKERS: readonly string[];
export const LOCATION_COUNTRY_BLOCKERS: readonly string[];
export const LOCATION_ACCEPTORS: readonly string[];
export const JUNIOR_TITLE_PATTERNS: readonly RegExp[];
export const NON_VUE_TITLE_PATTERNS: readonly RegExp[];
export const TAG_KEYWORDS: readonly string[];

// companies.shared.js
export interface CompanyEntry {
  readonly name: string;
  readonly ats: 'greenhouse' | 'ashby' | 'lever' | 'recruitee';
  readonly slug: string;
}
