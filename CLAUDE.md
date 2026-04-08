# vuenture — Context for Claude Code

**Owner.** Alfonso Cavalieri (@aljacket) — Senior Frontend Engineer, Valencia, Spain (CET).
**Stack.** Vue 3 + TypeScript + Tailwind + Pinia + Vite.
**What it is.** Personal job-search dashboard. GitHub Actions cron fetches jobs from JSearch + WeWorkRemotely + RemoteOK + Jobicy + Arbeitnow once per working day, applies hard filters, scores survivors with the `claude` CLI, commits `public/jobs.json`. The Vue frontend reads the static JSON.

## Hard rules

1. **Vue.js is a hard stack requirement.** F1 rejects anything without Vue/Nuxt in title or description. Do not weaken this — Alfonso is a Vue specialist.
2. **Nuxt is NOT a skill Alfonso has.** `nuxt` stays in `VUE_KEYWORDS` only as a *detection* signal (jobs mentioning Nuxt are Vue-ecosystem jobs). He has never used it in production. Roles that demand *deep* Nuxt expertise are a red flag in the scoring prompt, not a target. Do not add Nuxt-specific JSearch queries, do not list Nuxt among "core requirements" in the scoring prompt.
3. **Capacitor + Ionic is a real specialization.** Alfonso shipped hybrid iOS/Android apps at Metricool (2M+ users) and Sesame HR. Vue+Capacitor/Ionic roles should be ranked higher and there is a dedicated JSearch query for them.
4. **Location/timezone is permissive.** F2 accepts anything remote-compatible with Spain/CET: EU, EMEA, "European hours", worldwide. Rejects US-only, UK-only, APAC, LATAM-only, relocation-required. Spanish-language (Spain/LATAM-Spanish) and Italian-language (Italy) roles are also in scope — Alfonso speaks Spanish C1 and is native Italian.
5. **Do not overclaim Node.js.** Alfonso's Node depth is basic. Do not rank backend-heavy roles favorably.
6. **Use `claude` CLI, not the Anthropic API.** Alfonso has a Max subscription; API calls are extra cost, CLI is included. All LLM calls in this repo go through the CLI, and we use Haiku (`claude-haiku-4-5-20251001`) for scoring to preserve coding-session quota.
7. **Config is the source of truth.** Shared constants (skills matrix, JSearch queries, Vue/location/junior keywords, tags) live in `src/config/profile.shared.js` and are imported by both `scripts/fetchJobs.mjs` and `src/config/profile.ts`. Edit them in one place only. Frontend-only values (`PROFILE`, `SkillLevel` type) live in `profile.ts`. TypeScript types for the shared file live in `profile.shared.d.ts` — keep literal types in sync if you add/rename shared exports.

## Architecture

- `scripts/fetchJobs.mjs` is the full pipeline: fetch → regex filter → dedupe → score → write `public/jobs.json`. It has a `fallbackScore()` heuristic so it runs end-to-end even when the `claude` CLI is unavailable (useful for local dev).
- `src/composables/useJobs.ts` fetches the static JSON. No API keys live in the bundle.
- `src/composables/useJobFilter.ts` applies the *optional* UI-toggle filters (F5–F8). The mandatory filters (F1–F4) already ran in the Node script.
- Bookmarks persist in `localStorage` under key `vuenture:bookmarks`.

## Filter pipeline (authoritative)

| Stage | Where | Filters |
|---|---|---|
| Stage 1 | Node (`fetchJobs.mjs` → `passesHardFilters`) | F1 Vue, F2 location, F3 freshness (96h / 168h Monday), F4 anti-junior |
| Stage 2 | Node | dedup by `sha1(normalize(company) + normalize(title))` |
| Stage 3 | `claude` CLI per-job | scoring, reason, red flags |
| Stage 4 | Vue (`useJobFilter.ts`) | F5 salary, F6 TS, F7 AI tooling, F8 Capacitor/Ionic |

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # type-check + build
npm run fetch-jobs   # run the full pipeline locally (needs JSEARCH_KEY + optionally claude CLI)
```

## What NOT to do

- Don't introduce a backend server. The static JSON is the whole point.
- Don't call the Anthropic API directly with an API key. Use the `claude` CLI.
- Don't hard-reject on salary — many JDs omit it. Use "salary unknown" as a soft signal.
- Don't dedupe by URL. Same job appears on LinkedIn and Indeed with different URLs. Dedupe by company+title.
- Don't re-introduce the original PRD bugs: `num_pages` / `date_posted` (not `#_pages` / `date;_posted`), and do **not** pass `job_requirements=no_experience,...` to JSearch (that includes, not excludes, junior).

## Full PRD

See `docs/PRD.md` for the complete spec including scoring prompt contract, color tokens, and out-of-scope items.
