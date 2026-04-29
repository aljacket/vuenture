## 1. Type hygiene (prerequisite)

- [x] 1.1 Extend `Job['source']` union in `src/types/job.ts` with `'linkedin' | 'hackernews' | 'reddit'`
- [x] 1.2 Run `npm run build` and patch any newly-surfaced exhaustive-switch / mapping-object errors (likely in JobCard tag rendering and source-icon helpers, if any)

## 2. LinkedIn fetcher: third query

- [x] 2.1 In `scripts/fetchJobs.mjs` `fetchLinkedIn()`, add a third entry to `queries`: `{ keywords: 'vue capacitor ionic mobile', location: 'Europe', label: 'EU-mobile' }`
- [x] 2.2 Verify locally with `npm run fetch-jobs` that all three queries log a card count without throwing

## 3. LinkedIn enrichment: detail-page parser

- [x] 3.1 Add a helper `parseLinkedInDetailPage(html)` that extracts the description body from `section.show-more-less-html` / `div.description__text` / `div.show-more-less-html__markup` (try in order, return first non-empty match), strips HTML, collapses whitespace
- [x] 3.2 Add a helper `looksGated(html)` that returns true if the body matches `/Sign in|<title>LinkedIn<\/title>/` AND `html.length < 500`
- [x] 3.3 Add a helper `parseLinkedInSalary(html)` that scans for `salary` / `compensation` snippets and returns `{ min, max }` if both numbers parse, else `undefined`
- [x] 3.4 Unit-cover the parser with two saved fixtures (one with description, one gated) under `scripts/__fixtures__/linkedin/`

## 4. LinkedIn enrichment: pipeline integration

- [x] 4.1 Add an `enrichLinkedInJobs(jobs)` function that walks the post-dedupe list, filters by `source === 'linkedin' && rawDescription.length < 200`, fetches each `applyUrl` sequentially with a 250 ms delay and 8000 ms `AbortSignal.timeout`, calls the parser, and replaces `rawDescription` (prefixed with `title + company + location`)
- [x] 4.2 Implement the 50-enrichment cap and the gated-page abort behaviour (set a `gated = true` flag, break out of the loop on first gate detection)
- [x] 4.3 Wire `enrichLinkedInJobs` into `main()` between the dedupe step and the scoring loop
- [x] 4.4 Log a summary line `[linkedin enrich] enriched=X gated=Y skipped=Z` after the loop completes

## 5. Scoring prompt: contractor language

- [x] 5.1 Append a paragraph to `scripts/scoringPrompt.md` under *Context* spelling out: contractor / freelance / B2B are acceptable; agency staff-aug is a red flag with `stack_match` cap 60
- [ ] 5.2 Manually score one freelance job (e.g. the Jagaad example) via `node scripts/fetchJobs.mjs` against a hand-built fixture and verify the prompt no longer red-flags the contract form
- [ ] 5.3 Verify a known agency posting (any Toptal-style listing in past `jobs.json`) still gets the agency red flag and a stack_match ≤ 60

## 6. Interview-history composable

- [x] 6.1 Create `src/composables/useInterviewHistory.ts` exposing `entries: Ref<Record<string, Entry>>`, `mark(company, reason)`, `unmark(company)`, `isInterviewed(company)`, `getEntry(company)`. Persist to `localStorage` key `vuenture:interviewHistory` via a `watch` (mirror `useBookmarks.ts`)
- [x] 6.2 Implement first-launch seeding: only when `localStorage.getItem('vuenture:interviewHistory') === null` write the Reedsy seed entry; never re-seed
- [x] 6.3 Re-export the shared `normalize(s)` from a new `src/utils/normalize.ts` (currently only defined inside `scripts/fetchJobs.mjs`; copy the same implementation), and use it inside the composable
- [x] 6.4 Add a unit test for the composable covering: seed-on-null, no-seed-on-empty-object, mark/unmark roundtrip, normalized lookup

## 7. UI: filter chip and card markers

- [x] 7.1 Add `hideInterviewed: boolean` to `FilterState` in `src/types/job.ts`
- [x] 7.2 In `useFilterStore`, default `hideInterviewed` to `true` if `useInterviewHistory().entries` is non-empty at store-init time, else `false`
- [x] 7.3 Add a chip to `FilterBar.vue` with label `Hide interviewed` and a dynamic `(N)` count suffix when entries are non-empty
- [x] 7.4 In `useJobFilter.ts`, add an F9 step: when `filters.value.hideInterviewed` is true, exclude jobs whose normalized company is in the interview-history store
- [x] 7.5 In `JobCard.vue`, when the chip is OFF and the job's company is interviewed, render a subdued banner above the title reading `Already interviewed — {reason}` (or `Already interviewed` when reason is empty)
- [x] 7.6 In `JobCard.vue`, add a kebab/three-dots action menu with `Mark as interviewed…` / `Unmark` (whichever is applicable), and a small inline prompt for the reason

## 8. Verification

- [x] 8.1 `npm run build` passes with no TypeScript errors
- [ ] 8.2 `npm run dev` — open the dashboard, confirm Reedsy is auto-marked on first load (use a private window so localStorage is fresh), confirm the "Hide interviewed" chip is ON by default and removes Reedsy from the list, confirm toggling the chip OFF reveals the Reedsy card with the banner
- [x] 8.3 `npm run fetch-jobs` locally — confirm three LinkedIn queries fire, enrichment runs, and at least one previously-sparse LinkedIn job now has a >500 char `rawDescription` in the resulting `public/jobs.json`
- [ ] 8.4 Re-run the scoring loop on the enriched Jagaad-style fixture and verify the new score >65 with no `"sparse description"` red flag
