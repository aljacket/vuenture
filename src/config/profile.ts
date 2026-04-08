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

/**
 * JSearch queries, split by country target. Tuned against Alfonso's CV.
 *
 * Global queries use JSearch's default country index (US-based) and catch
 * worldwide / EU-friendly remote jobs. Spain queries pass country=es to
 * reach Indeed.es and Spain-based companies (Capitole, PrimeIT, etc.)
 * that the default JSearch index misses entirely. Two of the ES queries
 * are in Spanish because many Spain-local JDs are not written in English
 * (Alfonso speaks Spanish C1).
 *
 * 9 queries × ~21 working days = ~189 requests/month, under the JSearch
 * free-tier cap of 200/month.
 */
export const GLOBAL_QUERIES = [
  'Senior Vue.js developer remote',
  'Senior Vue 3 TypeScript frontend remote Europe',
  'Senior Vue.js Tailwind Pinia frontend remote',
  'Senior Vue.js Capacitor Ionic mobile developer remote',
  'Vue.js frontend technical lead remote',
  'Vue.js senior frontend AI assisted development remote',
] as const;

export const SPAIN_QUERIES = [
  'Vue.js developer remote',
  'Desarrollador Vue.js senior teletrabajo',
  'Programador frontend Vue senior remoto',
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
  'TypeScript',
  'Tailwind',
  'Pinia',
  'Vuex',
  'Vite',
  'Vitest',
  'Capacitor',
  'Ionic',
  'Composition API',
  'Claude Code',
  'MCP',
  'Nuxt',
  'GraphQL',
  'Node.js',
] as const;
