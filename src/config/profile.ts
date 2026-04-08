/**
 * Alfonso's fixed search persona.
 * Single source of truth for the Node fetch script AND the Vue frontend.
 * Stack = hard requirement. Location = permissive. Keep these axes separate.
 */

export const PROFILE = {
  name: 'Alfonso Cavalieri',
  base: 'Valencia, Spain',
  timezone: 'CET',
  seniorityYears: 10,
  salary: { minEUR: 45_000, maxEUR: 80_000 },
} as const;

/** Claude CLI queries — 5 queries × 1 page = 110 req/month, under the 200/mo free tier. */
export const QUERIES = [
  'Senior Vue.js developer remote',
  'Senior Vue frontend developer remote Europe',
  'Vue 3 TypeScript senior developer remote',
  'Vue.js Nuxt.js senior frontend remote EU',
  'Senior frontend engineer Vue Tailwind Pinia remote',
] as const;

/** F1 — Vue stack is a HARD requirement. At least one of these must appear. */
export const VUE_KEYWORDS = [
  'vue',
  'vue.js',
  'vuejs',
  'vue 3',
  'vue3',
  'nuxt',
  'nuxtjs',
  'nuxt.js',
] as const;

/** F2 — explicit geographic exclusions. Any match → reject. */
export const LOCATION_BLOCKERS = [
  'us only',
  'usa only',
  'u.s. only',
  'us citizens only',
  'uk only',
  'canada only',
  'latam only',
  'apac only',
  'must relocate',
  'on-site only',
  'onsite only',
  'no remote',
] as const;

/** F2 — positive signals that confirm the role accepts a Spain/CET worker. */
export const LOCATION_ACCEPTORS = [
  'remote',
  'fully remote',
  'full remote',
  'worldwide',
  'global',
  'europe',
  ' eu ',
  'emea',
  'spain',
  'cet',
  'european timezone',
  'european hours',
  'work from anywhere',
] as const;

/** F4 — anti-junior. Title-only check. */
export const JUNIOR_TITLE_PATTERNS = [
  /\bjunior\b/i,
  /\bentry.level\b/i,
  /\bintern(ship)?\b/i,
  /\btrainee\b/i,
  /\bgraduate\b/i,
];

/** Tags we want to surface as top-3 on a job card when detected. */
export const TAG_KEYWORDS = [
  'Vue.js',
  'Vue 3',
  'Nuxt',
  'TypeScript',
  'Tailwind',
  'Pinia',
  'Vite',
  'Vitest',
  'Capacitor',
  'Ionic',
  'GraphQL',
  'Node.js',
  'AWS',
  'Playwright',
] as const;
