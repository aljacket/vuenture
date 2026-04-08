# vuenture 🧭

> **Vue.js remote jobs, triaged.** A personal job-search dashboard that fetches real-time listings, hard-filters them against a Vue-senior-remote persona, and scores survivors with Claude — so you only see the 5–10 roles that actually matter.

Built by [@aljacket](https://github.com/aljacket) because manually grepping "Vue remote Spain" across five job boards daily is a life I refuse to live.

## Why this exists

Every job aggregator is tuned for breadth, not signal. You open LinkedIn, see 200 "Vue" results, and 180 of them are React roles where someone mentioned Vue once at the bottom. Or they're US-only. Or they're junior. Or they were posted 6 months ago and someone re-bumped them.

**vuenture** inverts the problem:
- Hard-rejects anything without Vue.js in the title or description.
- Hard-rejects geo-exclusive postings (US-only, APAC hours, "must relocate").
- Hard-rejects anything older than 96 hours (168h on Mondays, to bridge the weekend gap).
- Then asks Claude to score each survivor 0–100, explain in two lines why, and flag concerns like "Node.js backend heavy" or "on-call rotation."

The dashboard shows you a ranked list. You read 2-line reasons instead of 2-page JDs. You apply to the top 3. You go do something else with your afternoon.

## Architecture

```
                ┌─────────────────────────────┐
                │  GitHub Actions cron         │
                │  0 7 * * 1-5  (09:00 CET)    │
                └──────────────┬───────────────┘
                               │
                               ▼
        ┌─────────────┐   ┌────────────┐
        │  JSearch    │   │ Arbeitnow  │
        │  (RapidAPI) │   │ (free, EU) │
        └──────┬──────┘   └──────┬─────┘
               │                 │
               └────────┬────────┘
                        ▼
            ┌──────────────────────┐
            │ Stage 1: regex hard  │
            │ filters (F1–F4)      │
            └──────────┬───────────┘
                       ▼
            ┌──────────────────────┐
            │ Stage 2: dedupe      │
            │ by company+title     │
            └──────────┬───────────┘
                       ▼
            ┌──────────────────────┐
            │ Stage 3: claude CLI  │
            │ scores each survivor │
            └──────────┬───────────┘
                       ▼
            ┌──────────────────────┐
            │ commit public/       │
            │ jobs.json to repo    │
            └──────────┬───────────┘
                       ▼
            ┌──────────────────────┐
            │ Vue 3 dashboard      │
            │ reads static JSON    │
            │ (no API keys in FE)  │
            └──────────────────────┘
```

**Key design choice.** The frontend never calls an API. It fetches `/jobs.json`, a file that was committed by yesterday's Action run. This means:
- No CORS pain.
- No API keys in the browser bundle.
- No quota burned by page refreshes.
- The site can be deployed to any static host (GitHub Pages, Netlify, Cloudflare Pages).

## Tech stack

- **Frontend:** Vue 3 (Composition API), TypeScript, Tailwind CSS, Pinia, Vite
- **Pipeline:** Node 20, zero runtime deps (native `fetch` + `crypto`)
- **AI scoring:** [`@anthropic-ai/claude-code`](https://www.npmjs.com/package/@anthropic-ai/claude-code) CLI, authenticated via OAuth token (Claude Max subscription — no Anthropic API billing)
- **CI:** GitHub Actions

## Quick start

```bash
git clone https://github.com/aljacket/vuenture.git
cd vuenture
npm install
npm run dev
```

The dashboard will load whatever is in `public/jobs.json`. Initially it's empty — either wait for the first Action run or trigger a fetch locally.

### Running the fetch pipeline locally

```bash
cp .env.example .env
# fill in JSEARCH_KEY (get one at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch — free tier, no card)

npm run fetch-jobs
```

If the `claude` CLI is installed and authenticated, Stage 3 scoring runs. If not, a deterministic heuristic is used so you still get a populated dashboard — just with less nuanced scores.

## Setting up the daily GitHub Action

### 1. Create the RapidAPI key

Sign up at [RapidAPI JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch), subscribe to the free tier (200 req/month, no credit card), copy the key.

### 2. Generate a Claude CLI OAuth token

On your local machine (where you're already logged in to Claude Max):

```bash
claude setup-token
```

This prints a long-lived OAuth token. Copy it.

### 3. Add repo secrets

On GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Add:

| Name | Value |
|---|---|
| `JSEARCH_KEY` | Your RapidAPI key |
| `CLAUDE_CODE_OAUTH_TOKEN` | Output of `claude setup-token` |

### 4. Enable write permissions

**Settings → Actions → General → Workflow permissions → Read and write**. The workflow needs this to commit the updated `public/jobs.json`.

### 5. Trigger the first run

**Actions tab → Daily Job Fetch → Run workflow**. You should see `public/jobs.json` get updated within a couple of minutes.

From there, the cron (`0 7 * * 1-5`, 09:00 CET Mon–Fri) runs automatically.

## Project structure

```
vuenture/
├── docs/PRD.md                # Full product requirements (v1.1)
├── public/jobs.json           # Committed daily by the Action
├── scripts/
│   ├── fetchJobs.mjs          # The whole pipeline, one file
│   └── scoringPrompt.md       # Claude scoring instructions
├── src/
│   ├── config/profile.ts      # Hard-coded search persona
│   ├── types/job.ts           # Job + JobScore + FilterState
│   ├── composables/           # useJobs, useJobFilter, useBookmarks
│   ├── stores/jobStore.ts     # Pinia filter state
│   ├── components/            # JobCard, FilterBar, SkeletonCard
│   ├── views/DashboardView.vue
│   ├── App.vue
│   └── main.ts
└── .github/workflows/fetch-jobs.yml
```

## Quota math

- 5 queries × 1 page × 22 working days = **110 JSearch requests/month**
- JSearch free tier: 200/month → ~90 req/month of headroom for manual re-runs
- Claude CLI calls: ~10–30 per run, scored from your Max allowance — well under fair-use limits

## Customizing for yourself

Fork it, then edit `src/config/profile.ts` and the constants at the top of `scripts/fetchJobs.mjs`. The two files must stay in sync — they encode:
- Your stack keywords (currently `vue`, `nuxt`, etc.)
- Your location blockers and acceptors
- Your anti-junior title patterns
- Your query bank

Then rewrite `scripts/scoringPrompt.md` to describe YOUR persona, and update `CLAUDE.md` so future Claude Code sessions understand the rules.

## What's deliberately out of scope

- Email/Slack digest notifications
- User accounts or multi-user support
- A PWA wrapper or browser extension
- AI matching against a full CV / resume
- A job-application tracker / CRM

This is a triage tool, not a career-management platform. If you want those things, fork and build them.

## Credits

- Job data: [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) (Google for Jobs aggregator) and [Arbeitnow](https://www.arbeitnow.com/) (EU-focused, free API).
- Scoring: [Claude](https://claude.com/claude-code) via the `claude` CLI.
- Built with a lot of help from Claude Code itself. Recursion: ✅.

## License

MIT. Do whatever you want with it.
