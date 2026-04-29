# linkedin-source Specification

## Purpose
TBD - created by archiving change improve-linkedin-and-track-rejected-companies. Update Purpose after archive.
## Requirements
### Requirement: LinkedIn fetcher SHALL produce listings from at least three keyword variants

The LinkedIn guest-search fetcher SHALL run three queries per cron run, all with `f_WT=2` (remote-only) and `sortBy=DD` (date descending):
1. Vue.js frontend, location Europe, English keywords.
2. Desarrollador frontend Vue, location Spain, Spanish keywords.
3. Vue + Capacitor + Ionic + mobile, location Europe, English keywords.

#### Scenario: All three queries execute on a normal run

- **WHEN** `fetchLinkedIn()` is called and the LinkedIn endpoint returns 200 for each request
- **THEN** the function SHALL emit at least one log line per query labelled `[linkedin EU]`, `[linkedin ES]`, `[linkedin EU-mobile]` with the result count

#### Scenario: One query returns non-200

- **WHEN** the second query returns HTTP 429
- **THEN** the function SHALL log `[linkedin ES] 429`, skip that query, and continue with the third query

### Requirement: LinkedIn-only listings SHALL be enriched with the public detail-page description before scoring

After Stage 2 dedupe, the pipeline SHALL walk the merged job list and for every job whose `source === 'linkedin'` AND `rawDescription.length < 200`, fetch the URL in `applyUrl`, parse the description body from the LinkedIn detail-page HTML, and replace `rawDescription` with `${title}\n\nCompany: ${company}\nLocation: ${location}\n\n${parsedBody}`.

#### Scenario: Job is LinkedIn-only and detail page is reachable

- **WHEN** a deduped job has `source === 'linkedin'`, `rawDescription` is ~60 chars, and `applyUrl` returns 200 with a parseable body
- **THEN** `rawDescription` after enrichment SHALL be at least 500 chars and contain text from the body section
- **AND** the original `applyUrl`, `title`, `company` SHALL remain unchanged

#### Scenario: Job is LinkedIn-only but detail page returns a sign-in / captcha page

- **WHEN** the detail-page response body matches `/Sign in|<title>LinkedIn</title>/` AND the body is under 500 bytes (signal of a redirect to login)
- **THEN** the enrichment loop SHALL stop fetching further jobs in the same cron run, log `[linkedin enrich] gated by sign-in, abandoning enrichment`, and leave already-fetched jobs in their current state

#### Scenario: Job arrived from LinkedIn AND a richer source

- **WHEN** dedupe merged a LinkedIn card with a JSearch entry that supplied a 4 KB description
- **THEN** the merged job's `rawDescription` SHALL be the JSearch body (length ≥ 200) and the enrichment loop SHALL skip the job

### Requirement: LinkedIn enrichment SHALL respect rate limits and timeouts

Enrichment fetches SHALL be sequential, with a 250 ms delay between consecutive requests, an 8000 ms per-request timeout, and a hard cap of 50 enrichments per cron run.

#### Scenario: 51st candidate in a single run

- **WHEN** more than 50 LinkedIn-only jobs are eligible for enrichment in one run
- **THEN** the first 50 SHALL be enriched in order and the remainder SHALL be left with their sparse descriptions, with a log line `[linkedin enrich] cap reached (50)`

#### Scenario: Detail-page fetch hangs

- **WHEN** a single detail-page request takes longer than 8000 ms
- **THEN** that request SHALL be aborted, the job's `rawDescription` SHALL remain unchanged, and the loop SHALL continue with the next job

### Requirement: Source type union SHALL include `linkedin`, `hackernews`, `reddit`

The `Job['source']` TypeScript union in `src/types/job.ts` SHALL include `'linkedin'`, `'hackernews'`, and `'reddit'` as valid string-literal members.

#### Scenario: Type-check after change

- **WHEN** running `npm run build`
- **THEN** there SHALL be no TypeScript errors of the form `Type '"linkedin"' is not assignable to type ...` originating from `public/jobs.json` consumers

