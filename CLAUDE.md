# vuenture — Context for Claude Code

**Owner.** Alfonso Cavalieri (@aljacket) — Senior Frontend Engineer, Valencia, Spain (CET).
**Stack.** Vue 3 + TypeScript + Tailwind + Pinia + Vite.
**What it is.** Personal job-search dashboard. GitHub Actions cron fetches jobs from JSearch + Arbeitnow once per working day, applies hard filters, scores survivors with the `claude` CLI, commits `public/jobs.json`. The Vue frontend reads the static JSON.

## Hard rules

1. **Vue.js is a hard stack requirement.** F1 rejects anything without Vue/Nuxt in title or description. Do not weaken this — Alfonso is a Vue specialist.
2. **Location/timezone is permissive.** F2 accepts anything remote-compatible with Spain/CET: EU, EMEA, "European hours", worldwide. Rejects US-only, UK-only, APAC, LATAM-only, relocation-required.
3. **Do not overclaim Node.js.** Alfonso's Node depth is basic. Do not rank backend-heavy roles favorably.
4. **Use `claude` CLI, not the Anthropic API.** Alfonso has a Max subscription; API calls are extra cost, CLI is included. All LLM calls in this repo go through the CLI.
5. **Config is the source of truth.** `src/config/profile.ts` and the constants at the top of `scripts/fetchJobs.mjs` must stay in sync. When you change one, check the other.

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
