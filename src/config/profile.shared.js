/**
 * Shared config — single source of truth for both the Node fetch script
 * and the Vue frontend. Written as plain `.mjs` so `scripts/fetchJobs.mjs`
 * can import it directly without a build step, and re-exported from
 * `src/config/profile.ts` for the Vue side.
 *
 * If you need narrow TypeScript types for any of these on the frontend,
 * add them in `profile.ts` on top of the re-export — do NOT move the
 * values back into the `.ts` file, or the duplication returns.
 */

/**
 * Skills matrix — modular, per-skill proficiency level. The scoring prompt
 * reads this at runtime, so bumping a backend skill from 'none' to
 * 'learning'/'basic'/'strong' automatically softens penalties next run.
 *
 * Levels:
 *   'expert'   — differentiator, reward explicit bonuses
 *   'strong'   — full production confidence
 *   'basic'    — can contribute, neutral signal
 *   'learning' — actively studying, small penalty instead of red flag
 *   'none'     — no experience, red flag if required as core stack
 */
export const SKILLS = {
  // Frontend & cross-platform
  vue: 'expert',
  typescript: 'expert',
  tailwind: 'expert',
  capacitor: 'expert',

  // AI-enhanced development
  claude_code: 'expert',
  claude_skills: 'expert',
  claude_agents: 'expert',

  // Frontend tooling
  vitest: 'strong',
  figma: 'strong',
  pinia: 'strong',

  // Backend — add skills here as you learn them
  node: 'basic',
};

/**
 * JSearch queries as (query, country) pairs. `country: null` = the default
 * global/US index (English, worldwide remote). Country codes target Indeed
 * national indexes that the global index misses.
 *
 * Country selection was driven by a market-yield probe (Apr 2026):
 *   ES: 10 · PT: 8 · DE: 2 · FR: 1 · NL/IE/GB: 0 (dropped).
 *   IT was dropped (Apr 2026) — Alfonso is not targeting the Italian market.
 *
 * Alfonso speaks Spanish (C1) so local-language queries are included
 * for Spain. PT uses English because Portuguese JDs are usually
 * cross-posted in English.
 *
 * 8 queries × ~21 working days = ~168 req/month, within JSearch free tier.
 */
export const JSEARCH_QUERIES = [
  // Global index (English, worldwide remote). "Frontend" keyword is
  // explicit in every query to steer Indeed/JSearch away from the
  // full-stack bias of generic "Vue.js developer" searches.
  { query: 'Senior Vue.js frontend engineer remote', country: null },
  { query: 'Vue.js Capacitor Ionic mobile frontend developer remote', country: null },
  { query: 'Vue.js senior frontend AI assisted development remote', country: null },
  // Spain — Alfonso lives here, speaks Spanish C1. Four queries because
  // the Spanish market is the highest-relevance local market and each
  // query variant surfaces a different slice of Indeed.es.
  { query: 'Vue.js frontend developer remote', country: 'es' },
  { query: 'Programador frontend Vue senior remoto', country: 'es' },
  { query: 'Desarrollador Vue senior teletrabajo España', country: 'es' },
  { query: 'Programador Vue remoto', country: 'es' },
  // Portugal — Lisbon tech hub, English-friendly
  { query: 'Vue.js frontend developer remote', country: 'pt' },
  // Germany was dropped — probe returned 1-2 results only and the query
  // budget was better spent on additional ES variants above.
];

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
];

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
];

/**
 * F2 — country codes that reject a job regardless of its remote flag.
 * Matched against the *structured* location string (e.g. "Roma, IT"), not
 * against the free-text description — otherwise we'd nuke legit pan-EU
 * roles that happen to mention Italy in a list of supported countries.
 *
 * IT was dropped Apr 2026 — Alfonso is not targeting the Italian market,
 * but JSearch's `job_is_remote === true` was letting IT-located listings
 * through Stage 1 anyway.
 */
export const LOCATION_COUNTRY_BLOCKERS = ['IT'];

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
  // Local-language remote terms (so Duunitori FI jobs don't get nuked)
  'etätyö',     // Finnish: remote work
  'etänä',      // Finnish: remotely
  'teletrabajo', // Spanish
];

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
];
