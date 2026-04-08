/**
 * Alfonso's fixed search persona.
 *
 * Frontend-only values live here. Values that also need to be consumed
 * by `scripts/fetchJobs.mjs` live in `./profile.shared.mjs` and are
 * re-exported below so the frontend can keep importing everything from
 * `@/config/profile`. Do NOT duplicate the shared constants here.
 */

export {
  SKILLS,
  JSEARCH_QUERIES,
  VUE_KEYWORDS,
  LOCATION_BLOCKERS,
  LOCATION_ACCEPTORS,
  JUNIOR_TITLE_PATTERNS,
  TAG_KEYWORDS,
} from './profile.shared.js';

export const PROFILE = {
  name: 'Alfonso Cavalieri',
  base: 'Valencia, Spain',
  timezone: 'CET',
  seniorityYears: 10,
  salary: { minEUR: 45_000, maxEUR: 80_000 },
} as const;

export type SkillLevel = 'expert' | 'strong' | 'basic' | 'learning' | 'none';
