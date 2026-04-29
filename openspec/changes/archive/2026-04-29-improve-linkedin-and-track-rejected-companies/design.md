## Context

The fetch pipeline (`scripts/fetchJobs.mjs`) runs Stage 0 (fetch from N sources) → Stage 1 (regex hard filters) → Stage 2 (dedupe by `sha1(company+title)`) → Stage 3 (LLM scoring via `claude` CLI) → write `public/jobs.json`. The LinkedIn fetcher (`fetchLinkedIn`, lines 690–760) currently returns cards built from the search-results HTML only. Each card holds a `rawDescription` of `${title}\n\nCompany: ${company}\nLocation: ${loc}` — about 60 characters. When the same job is also returned by JSearch / Jobicy / etc. the `mergeRawJobs` step replaces the sparse description with the longer one (see `pickLonger`, line 1192). When the job is *only* on LinkedIn, the sparse description is what reaches Claude.

Stage 3 sends `stripHtml(raw.rawDescription).slice(0, 2000)` to the model. With ~60 chars of input, scoring is essentially title-only, which is exactly what produced the Jagaad screenshot: red flag *"Extremely sparse job description"*, overall 55, despite a perfectly aligned title. Two LinkedIn queries are wired (Vue.js EU + desarrollador frontend ES). There is no Capacitor/Ionic-targeted query, even though that's a JSearch query and a documented specialization.

The frontend already persists per-job state via `useBookmarks.ts` → `localStorage` key `vuenture:bookmarks`. There is no equivalent for company-level signals. Alfonso interviewed at Reedsy and was rejected on FE-architecture depth (hexagonal/DDD); Reedsy is in `companies.shared.js` so it's still being polled and re-surfaced every cron run.

## Goals / Non-Goals

**Goals:**
- LinkedIn-only listings reach Stage 3 with a description body of at least ~500 chars when LinkedIn's detail page exposes one.
- Adding ~one query slot to LinkedIn's keyword set without doubling its request budget.
- Contractor / freelance / B2B roles do not get penalized in scoring just for the employment form.
- Each company can be marked "already interviewed, not hired" with a free-text reason; the dashboard hides those by default but a toggle reveals them.
- Reedsy is pre-populated with a reason on first launch so the UX is observable without manual setup.

**Non-Goals:**
- No backend, no remote sync. Interview history stays per-device — same constraint as bookmarks.
- No richer enrichment for HN / Reddit / WWR / RemoteOK. Their snippets are already richer than LinkedIn's.
- No per-job (as opposed to per-company) interview history. Granularity is intentionally coarse: if you interviewed at Reedsy, every Reedsy posting is downstream of that signal.
- No removal of Reedsy / similar from the watchlist. The user wants to *mark* not *remove* — situation can change (different team, different role).
- No automated rejection-detection from email. Manual marking only.

## Decisions

### D1. LinkedIn detail-page enrichment, not API replacement

**Decision:** Keep the guest-search fetch for the listing snapshot, but for each card whose body is sparse, follow the `applyUrl` → fetch the public job-detail page → parse `<section class="show-more-less-html"...>` (or the `description__text` selector LinkedIn uses on guest pages) into plain text → set `rawDescription` to that text (with `title + company + location` prefixed so existing F1/F2 keyword checks still find their signals).

**Alternatives considered:**
- *Use a third-party LinkedIn API (e.g. RapidAPI Real-Time LinkedIn Scraper, Bright Data).* Rejected: extra paid dependency, defeats the "static JSON, free tier" architecture.
- *Drop LinkedIn entirely, lean on JSearch which already aggregates LinkedIn.* Rejected: JSearch's LinkedIn coverage in Spain is thin (probe data showed mostly Indeed-sourced rows in `country: 'es'`), and LinkedIn surfaces a different slice (often EU-tier consultancies that don't post to JSearch).
- *Skip enrichment, ask Claude to infer from title.* Rejected: that's the status quo and the screenshot demonstrates it produces flat-50s for legit roles.

**Why this wins:** keeps the architecture (no new keys, no new vendors), pays for itself with one extra GET per LinkedIn-only job, and the enrichment runs *before* dedupe so if the job is also on JSearch the merge will keep whichever description is longer (which may still be the JSearch one — that's fine).

### D2. Enrich after Stage 2 dedupe, not before

**Decision:** Run enrichment in Stage 2.5: after `mergeRawJobs` finishes, walk the dedup'd list and for each job whose `source === 'linkedin'` AND whose `rawDescription.length < 200` chars, fetch and replace.

**Why:** if the same job arrived from JSearch with a 4 KB description, dedupe already replaced the sparse LinkedIn body with the rich one — fetching the LinkedIn detail page is wasted I/O. Length-gating saves ~60% of detail-page hits in a typical run (estimate based on a sample week of `jobs.json` cross-source overlap).

### D3. Concurrency & politeness for LinkedIn enrichment

**Decision:** Sequential fetches, 250 ms delay between requests, 8-second per-request timeout, max 50 enrichments per cron run. Failures are silent (keep the sparse body, do not throw).

**Alternatives:**
- *Concurrent batch (e.g. `Promise.all` of 5).* Rejected for now: LinkedIn aggressively rate-limits guest traffic and bursts trigger captcha pages.
- *Cache enrichments across runs in `public/jobs.json`.* Deferred: requires a JD store keyed by `applyUrl`. Worth doing later if enrichment latency becomes a bottleneck (>2 min total). Not in this change.

### D4. Add one LinkedIn query for Capacitor/Ionic, drop nothing

**Decision:** New query `{ keywords: 'vue capacitor ionic mobile', location: 'Europe', label: 'EU-mobile' }`. Three queries total. The current EU and ES queries stay.

**Rationale:** matches the existing JSearch query #2 (`Vue.js Capacitor Ionic mobile frontend developer remote`). LinkedIn's keyword search is a soft AND, so requiring all four words keeps the result set narrow (typically <20 cards/run) and high-signal.

### D5. Contractor acceptance is in the scoring prompt, not in the hard filters

**Decision:** Append a paragraph to `scripts/scoringPrompt.md` under *Context*: contractor / freelance / B2B engagements are acceptable employment forms; do NOT red-flag them. *Do* still red-flag agency staff-aug / dev shop body-shopping (signal: "client-facing consultant", multiple short-term placements, "we'll match you to clients").

**Why prompt-side:** F1–F5 are designed to be coarse and conservative; the contractor signal is too fuzzy for regex (the same job might say "contract role" benignly or "12-week contract via our agency network" malignly). Claude can read the difference. Hard filters stay focused on stack / location / freshness / seniority.

### D6. Interview history shape

**Decision:** `localStorage` key `vuenture:interviewHistory`. Value: `Record<string, { reason: string, markedAt: string }>` where the key is `normalize(company)` (same `normalize` function used by `makeId`).

**Why a record, not a set:** we need to store the rejection reason ("FE architecture depth — under study"). Persisted as a JSON object so adding fields later (interview round, date) is non-breaking.

**Why per-company normalized:** matches how dedupe works — "Reedsy", "Reedsy Ltd", "reedsy" all collapse. UI shows the most-recent unnormalized form for display.

### D7. UI integration

**Decision:**
- New composable `src/composables/useInterviewHistory.ts` exposing `mark(company, reason)`, `unmark(company)`, `isInterviewed(company)`, `getEntry(company)`. Mirrors `useBookmarks.ts` shape.
- New filter chip on `FilterBar.vue`: `Hide interviewed` (default ON when entries exist; default OFF when empty). Wired through `useJobFilter.ts` as F9.
- On `JobCard.vue`: when `isInterviewed(job.company)` is true and the chip is OFF, render a small ghost banner above the title (`"Already interviewed — {reason}"`) plus a kebab menu action `Unmark`.
- Small `+` icon (or three-dots menu) on every card with action `Mark as interviewed…` opening a one-line prompt for the reason. Reason is optional; empty string is allowed.

### D8. Seed Reedsy on first launch

**Decision:** `useInterviewHistory.ts` checks if `localStorage` key is *missing* (not just empty `{}`); if missing it writes `{ "reedsy": { reason: "Frontend architecture depth (hexagonal/DDD) — under study", markedAt: <now> } }` once. After that, the user owns the store.

**Why this distinction:** if the user later unmarks Reedsy, we must NOT re-seed on next page load. Empty-object state is a valid "user cleared everything" state and must be respected.

## Risks / Trade-offs

- **Risk:** LinkedIn updates the guest-page HTML and our enrichment selector breaks silently. → **Mitigation:** wrap parsing in try/catch, fall back to sparse description, log `[linkedin enrich] selector miss for {applyUrl}`. The pipeline keeps working; we just lose enrichment until the selector is patched.
- **Risk:** LinkedIn rate-limits or shows a captcha page. → **Mitigation:** 250 ms delay, 50/run cap, detect captcha by content (`<title>Sign in</title>` or HTML <500 bytes) and stop enrichment for the rest of the run.
- **Risk:** Adding source values `'linkedin' | 'hackernews' | 'reddit'` to the type union surfaces latent type errors in switch statements / mapping objects. → **Mitigation:** grep for `job.source ===` and `case '...'` before merging; bulk fixup is small.
- **Risk:** The "Hide interviewed" filter defaulting ON could hide jobs from users who add a single mark out of curiosity. → **Mitigation:** chip shows the active count (`Hide interviewed (3)`). User can toggle off in one click. Default ON is justified because the only reason to mark a company is to suppress it.
- **Trade-off:** per-company granularity means a company that interviewed for role A and rejected gets all roles hidden, including a future role B at the same company that might be different (different team, different fit signal). Acceptable: the user can unmark or temporarily flip the chip off to peek. Solving per-role would require role-stable IDs that survive across cron runs, which dedupe-by-title already gives us — but the UX of marking individual roles every cron is too high-touch.
