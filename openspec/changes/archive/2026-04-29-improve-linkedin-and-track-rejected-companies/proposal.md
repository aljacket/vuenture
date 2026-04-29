## Why

The LinkedIn fetcher (`scripts/fetchJobs.mjs`, added 2026-04-16) ships incomplete: each card produces a `rawDescription` of just `title + company + location`, so when a LinkedIn-only listing reaches the scoring stage the LLM has no signal beyond the title. The Jagaad "Senior Vue.js Frontend Developer" example scored 55 with red flag *"Extremely sparse job description"* — a role Alfonso considered well-aligned was demoted because of how we fetched it, not because of fit. At the same time, the dashboard re-surfaces companies Alfonso has already interviewed with and been rejected by (e.g. Reedsy, where the rejection was on FE-architecture depth). He needs a way to mark and filter those without losing the data.

## What Changes

- **LinkedIn**: enrich each LinkedIn card by fetching its public detail page once per job, parsing the description body, and storing it as `rawDescription`. Skip enrichment when a richer variant of the same job is already in the dedup pool. Cap concurrency and add a per-fetch timeout so a slow LinkedIn doesn't block the cron.
- **LinkedIn**: add a third query targeting Vue + Capacitor/Ionic specifically, mirroring the JSearch query for that specialization.
- **LinkedIn**: parse `salary` / `salary-range` snippets from the detail page when present (LinkedIn rarely exposes them, but worth capturing when it does).
- **Scoring contract**: explicitly mark contractor / freelance / B2B as acceptable employment forms (today the prompt says nothing, so Claude sometimes flags contract roles as risk). Cap the cap on contractor: still penalize agency-style staff augmentation roles.
- **Type hygiene**: extend `Job['source']` union to include `'linkedin' | 'hackernews' | 'reddit'` (currently absent — recent fetchers added them at runtime but never at the type level).
- **Interview history**: add a per-company "interviewed, not hired" mark with optional rejection reason, persisted in `localStorage` under `vuenture:interviewHistory` (mirrors the bookmarks composable). On the job card a small ghost icon labels the company; a new chip filter `Hide interviewed` (F9) hides them from the main list.
- **Interview history**: seed the store with `Reedsy → "Frontend architecture depth (hexagonal/DDD) — under study"` so the feature is live on first load.

## Capabilities

### New Capabilities

- `linkedin-source`: fetching, enrichment, and per-source filter behavior for the LinkedIn guest-search adapter.
- `interview-history`: client-side store and UI for marking companies Alfonso has already interviewed with, with rejection reason and a list-level filter.
- `contractor-acceptance`: scoring-prompt guarantee that contractor / freelance / B2B roles are first-class, not red-flagged by default.

### Modified Capabilities

<!-- None — `openspec/specs/` is empty; all behavior is being specified for the first time. -->

## Impact

- **Code**: `scripts/fetchJobs.mjs` (LinkedIn fetcher + main loop), `scripts/scoringPrompt.md` (contractor language), `src/types/job.ts` (source union), new `src/composables/useInterviewHistory.ts`, `src/components/FilterBar.vue` (new chip), `src/components/JobCard.vue` (interview marker + actions), `src/stores/jobStore.ts` (new filter key).
- **Data**: new `localStorage` key `vuenture:interviewHistory` storing `Record<companySlug, { reason: string, markedAt: string }>`. No migration needed.
- **External**: one extra HTTP GET per LinkedIn job per cron run. ~10–30 requests/day at current volume; well below LinkedIn guest-tier abuse thresholds, but we add a 250ms delay between requests as a politeness margin.
- **Out of scope**: enrichment for HN/Reddit (their snippets are already richer), per-role rejection tracking (granularity is per-company by design), and any backend persistence of interview history (stays purely local — same constraint as bookmarks).
