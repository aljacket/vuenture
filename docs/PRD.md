# vuenture — Product Requirements Document

> Personal Vue.js job-search tool · Alfonso Cavalieri · April 2026 · **v1.1**

## 1. Overview

A Vue 3 + TypeScript personal job-search dashboard. A GitHub Actions cron runs once per working day, hits real-time job APIs, filters + scores listings with the `claude` CLI, and commits a static `public/jobs.json`. The Vue app reads the JSON and renders a clean, scannable dashboard — no API keys in the browser, no quota leaks, no CORS.

| Field | Value |
|---|---|
| Owner | Alfonso Cavalieri (@aljacket) |
| Stack | Vue 3 · TypeScript · Tailwind CSS · Pinia · Vite |
| Primary API | JSearch via RapidAPI (free tier: 200 req/month) |
| Fallback API | Arbeitnow (free, no key, EU-focused) |
| AI scoring | `claude` CLI inside GitHub Actions (uses Max subscription, no API billing) |
| Status | MVP — personal tool, public repo |

## 2. Candidate Profile (Search Persona)

Hard-coded in `src/config/profile.ts`. Two dimensions kept strictly separate:

**A. Stack (HARD requirement — non-negotiable)**

| Attribute | Value | Priority |
|---|---|---|
| Primary framework | Vue.js 3 (Composition API) — must be PRIMARY in the role | MUST |
| Languages | TypeScript 5+ · JavaScript ES2024+ | MUST |
| Seniority | Senior · 10+ yrs total · 5+ yrs Vue.js | MUST |
| Secondary acceptable | Nuxt.js, Pinia, Tailwind, Vitest | NICE |
| React/Next as secondary | Accepted only if Vue is also primary | NICE |
| Capacitor / Ionic | Mobile niche bonus | NICE |
| AI tooling | Claude Code, MCP, Copilot, prompt engineering | NICE |
| Node.js | Basic only — do NOT overclaim | WARN |

**B. Location / Timezone (PERMISSIVE)**

| Attribute | Value |
|---|---|
| Candidate base | Valencia, Spain · CET (UTC+1) |
| Employer requirement | Must accept full-remote worker based in Spain |
| Acceptable employer locations | Spain, EU, EMEA, "European timezone", "CET ±3h", worldwide-remote |
| Rejected | Explicit "US only", "UK only", "LATAM only", "APAC hours", "must relocate" |

**C. Economics**

| Attribute | Value |
|---|---|
| Salary range | €45K–€80K gross/year (preference, not hard filter) |
| Employment type | Full-time |
| Industry | SaaS B2B, HR Tech, AI-first, Remote-first (soft preference) |

## 3. Problem & Goals

**Problem.** Manual searches across 5+ boards return stale, expired, and off-target listings. Filtering "Vue remote Spain" by hand is unsustainable and error-prone.

**Goals.**
1. Query real-time APIs daily, return only listings posted within the last 96 hours (widened from 72h to catch Fri→Mon gap).
2. Hard-reject non-Vue and geographically-exclusive roles before scoring.
3. Use `claude` CLI to **score and explain** each surviving listing (0–100, 2-line reasoning, red flags).
4. Render ranked results in a scannable dashboard with direct apply links.
5. Bookmark interesting listings in `localStorage`.

## 4. API Integration

### 4.1 JSearch (primary)

- Endpoint: `https://jsearch.p.rapidapi.com/search`
- Key params: `query`, `num_pages`, `date_posted=week` (on Monday) or `3days` (Tue–Fri), `employment_types=FULLTIME`
- ❗ The original PRD had a typo: use `num_pages` and `date_posted`, **not** `#_pages` / `date;_posted` (HTML escape artifacts).
- ❗ Do **not** pass `job_requirements=no_experience,under_3_years_experience` — that parameter *includes* those levels, it does not exclude them. Seniority filtering is done client-side on `title`.
- Auth: `X-RapidAPI-Key` header from `JSEARCH_KEY` env (GitHub secret, never in bundle).

### 4.2 Arbeitnow (fallback)

- Endpoint: `GET https://www.arbeitnow.com/api/job-board-api?tags[]=vue&tags[]=typescript&remote=true`
- No key required. EU-focused. Used when JSearch quota is thin, and as a dedup source.

### 4.3 Quota math

5 queries × 1 page × 22 working days = **110 req/month** → comfortably under JSearch's 200/mo free tier, leaves headroom for manual re-runs.

## 5. Filter & Scoring Pipeline

The pipeline has **three stages**. Stage 1 and 2 run in Node (fast, cheap). Stage 3 runs `claude` CLI only on survivors (slow-ish, costs "AI budget" of the Max subscription).

### Stage 1 — Hard filters (Node regex, pre-score)

| # | Filter | Rule | On fail |
|---|---|---|---|
| F1 | **Vue stack** | title/description must contain `vue`, `vue.js`, `vuejs`, `vue 3`, or `nuxt` | REJECT |
| F2 | **Location compatibility** | description must NOT contain explicit geo-exclusions (`us only`, `uk only`, `latam only`, `apac`, `must relocate`); MUST mention one of `remote`, `worldwide`, `europe`, `eu`, `emea`, `spain`, `cet`, `global` | REJECT |
| F3 | **Freshness** | `job_posted_at_datetime` within 96h (Monday run uses 168h/7d window to bridge weekend gap) | REJECT |
| F4 | **Anti-junior** | title must NOT contain `junior`, `entry level`, `intern`, `trainee` | REJECT |

### Stage 2 — Deduplication

Hash on `normalize(company) + normalize(title)`. Not on URL — same job is posted on LinkedIn and Indeed with different URLs.

### Stage 3 — Claude CLI scoring

For each survivor, pipe the JD into `claude -p "$(cat scripts/scoringPrompt.md)" --output-format json`. Expected JSON shape:

```json
{
  "overall": 0-100,
  "stack_match": 0-100,
  "location_ok": true,
  "seniority_fit": "junior" | "mid" | "senior" | "lead+",
  "ai_bonus": 0-20,
  "reason": "2-line human explanation",
  "red_flags": ["Node.js backend heavy", "on-call required"]
}
```

Results are merged onto the `Job` object and sorted by `overall` desc before writing `public/jobs.json`.

### Stage 4 — Optional frontend filters (UI toggles)

| # | Filter | Scope |
|---|---|---|
| F5 | Salary in €45K–€80K (or unknown) | toggle |
| F6 | TypeScript explicit requirement | toggle |
| F7 | AI tooling mentioned | toggle |
| F8 | Capacitor / Ionic | toggle |

These filter the already-scored jobs client-side; they do not trigger a re-fetch.

## 6. UI / UX

**Layout.** Header (app name · last refreshed · refresh button · settings) → filter chip bar → responsive 1/2/3-column card grid.

**Card fields.** Score badge (colored by bucket) · job title · company · location badge · remote badge · relative date (`2h ago`) · salary if known · top 3 tech tags · 2-line Claude reason · red flag chips · Apply CTA · bookmark star.

**States.** Loading = 3 skeleton cards. Empty = friendly illustration + "No matches in the last 96h". Error = toast with retry.

**Palette (Tailwind tokens).**

| Token | Hex | Usage |
|---|---|---|
| ink-900 | `#1a1a2e` | headers, primary text |
| indigo-600 | `#4f46e5` | CTAs, active chips, score 80+ |
| indigo-100 | `#f5f3ff` | card backgrounds |
| must-red | `#dc2626` | MANDATORY labels, red flags |
| nice-green | `#059669` | NICE-TO-HAVE labels, score 60–79 |
| warn-amber | `#d97706` | uncertain remote, score 40–59 |

## 7. Data Model

```ts
// src/types/job.ts
export interface JobScore {
  overall: number;
  stack_match: number;
  location_ok: boolean;
  seniority_fit: 'junior' | 'mid' | 'senior' | 'lead+';
  ai_bonus: number;
  reason: string;
  red_flags: string[];
}

export interface Job {
  id: string;                 // hash(company + title)
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  remotePolicy: 'remote' | 'hybrid' | 'onsite' | 'uncertain';
  postedAt: string;           // ISO
  salaryMin?: number;
  salaryMax?: number;
  tags: string[];
  applyUrl: string;
  source: 'jsearch' | 'arbeitnow';
  rawDescription: string;
  score: JobScore;
  bookmarked?: boolean;
}

export interface FilterState {
  salaryFilter: boolean;
  typescriptRequired: boolean;
  aiToolingBonus: boolean;
  capacitorBonus: boolean;
}
```

## 8. Project Structure

```
vuenture/
├── docs/
│   └── PRD.md
├── public/
│   └── jobs.json                # committed by GH Action
├── scripts/
│   ├── fetchJobs.mjs            # Node: fetch → filter → score → write
│   └── scoringPrompt.md         # Claude scoring instructions
├── src/
│   ├── config/profile.ts        # persona constants
│   ├── types/job.ts
│   ├── composables/
│   │   ├── useJobs.ts
│   │   ├── useJobFilter.ts
│   │   └── useBookmarks.ts
│   ├── stores/jobStore.ts
│   ├── components/
│   │   ├── JobCard.vue
│   │   ├── FilterBar.vue
│   │   └── SkeletonCard.vue
│   ├── views/DashboardView.vue
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── .github/workflows/fetch-jobs.yml
├── .env.example
├── .gitignore
├── CLAUDE.md
├── README.md
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## 9. Query Bank

```ts
// in src/config/profile.ts
export const QUERIES = [
  'Senior Vue.js developer remote',
  'Senior Vue frontend developer remote Europe',
  'Vue 3 TypeScript senior developer remote',
  'Vue.js Nuxt.js senior frontend remote EU',
  'Senior frontend engineer Vue Tailwind Pinia remote',
] as const;
```

## 10. Scheduling

GitHub Action cron: `0 7 * * 1-5` → 09:00 CET Monday–Friday. Manual trigger via `workflow_dispatch` is also enabled. Monday run uses a wider date window (`date_posted=week`) to bridge the weekend gap.

## 11. Scope

**IN (MVP).** JSearch + Arbeitnow integration · Stage 1–3 pipeline · Claude CLI scoring · ranked dashboard · bookmark in localStorage · responsive Tailwind layout · GitHub Actions cron · public repo with README.

**OUT (v2+).** Email/Slack digest · user auth · browser extension · CV ↔ JD fine-grained matching · Manfred/VueJobs integration · PWA wrapper · application tracker/CRM.

## 12. Known Risks

- JSearch free tier quota exhaustion mid-month → mitigation: 1 page per query, Arbeitnow fallback.
- Claude CLI OAuth token expiry in GitHub Actions → mitigation: document renewal in README.
- Keyword-based F1 may miss Vue roles where the stack is only in JD images → accepted, not worth fixing in MVP.
- Aggregator APIs return stale duplicates → mitigation: Stage 2 dedup by company+title.
```

