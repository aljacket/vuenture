#!/usr/bin/env node
/**
 * vuenture — daily job fetch pipeline.
 *
 * Runs in GitHub Actions (or locally with `npm run fetch-jobs`).
 *
 * Pipeline:
 *   1. Query JSearch + Arbeitnow
 *   2. Stage 1 — hard regex filters (Vue / location / freshness / anti-junior)
 *   3. Stage 2 — deduplicate by normalize(company + title)
 *   4. Stage 3 — pipe each survivor into `claude` CLI for scoring
 *   5. Sort by score.overall, write public/jobs.json
 *
 * Secrets expected (env):
 *   JSEARCH_KEY             RapidAPI key for JSearch
 *   CLAUDE_CODE_OAUTH_TOKEN Claude CLI OAuth token (Max subscription)
 */

// NOTE on sources:
// - JSearch (RapidAPI): US-biased but with the best text search AND
//   aggregates Indeed/LinkedIn/Glassdoor/ZipRecruiter under the hood.
//   Our primary source.
// - WeWorkRemotely: the `remote-programming-jobs` RSS feed is the single
//   best Vue-yield source we've found (~8% Vue hits on a random day, most
//   of them "Anywhere in the World"). Parsed with regex — the feed shape
//   is stable and the dep cost of a real XML parser isn't worth it.
// - Arbeitnow: EU/Germany-focused feed (single page, ~100 jobs). Their
//   tags[]=vue query is broken server-side so we fetch the general feed
//   and filter for Vue client-side.
// - RemoteOK: public JSON feed (~100 jobs per request). Their tag=vue
//   filter returns nothing because jobs are tagged with generic labels
//   ("front end") rather than stack names, so we also filter client-side.
// - Jobicy: smaller feed but their `tag=vue` parameter does real
//   server-side filtering — cheap to keep in the loop.
//
// Evaluated and rejected:
// - Remotive: free API returns ~20 jobs total worldwide ($5k/mo for
//   real feed). Dropped.
// - Himalayas: 99K jobs total but a hard limit=20 per request and no
//   working text/category filter. Exhaustive pagination isn't feasible.
// - Indeed: killed their public Publisher API in 2023; now enterprise
//   partnership only. JSearch already covers Indeed under the hood.
// - RemoteRocketship: /api returns 403 and their robots.txt explicitly
//   Disallows /api. Their business model is gated browsing/screening;
//   scraping HTML would be fragile and unfriendly. Don't add.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- Config (mirrors src/config/profile.ts — keep in sync) ------------------

// JSearch query set split by country target.
//
// - Global queries use JSearch's default country (US-indexed). They catch
//   the worldwide/EU remote market including WWR/LinkedIn/Glassdoor jobs.
// - ES queries pass country=es and target the Spanish market directly —
//   this is the only way to reach Indeed.es, InfoJobs-aggregated postings,
//   and Spain-based companies like Capitole/PrimeIT that the default
//   JSearch index misses entirely. Two of them are in Spanish because
//   many Spain-local JDs are not in English.
//
// 9 queries × ~21 working days = ~189 req/month, under the 200/mo free
// tier with a small buffer for manual re-runs.
const GLOBAL_QUERIES = [
  'Senior Vue.js developer remote',
  'Senior Vue 3 TypeScript frontend remote Europe',
  'Senior Vue.js Tailwind Pinia frontend remote',
  'Senior Vue.js Capacitor Ionic mobile developer remote',
  'Vue.js frontend technical lead remote',
  'Vue.js senior frontend AI assisted development remote',
];

const SPAIN_QUERIES = [
  'Vue.js developer remote',
  'Desarrollador Vue.js senior teletrabajo',
  'Programador frontend Vue senior remoto',
];

const VUE_KEYWORDS = ['vue', 'vuejs', 'vue.js', 'vue 3', 'vue3', 'nuxt'];

const LOCATION_BLOCKERS = [
  'us only', 'usa only', 'u.s. only', 'us citizens only',
  'uk only', 'canada only', 'latam only', 'apac only',
  'must relocate', 'on-site only', 'onsite only', 'no remote',
];

/**
 * Regex blockers for gating phrases that substring matching can't catch.
 * These run as a cheap pre-filter before Claude scoring so we don't waste
 * CLI calls on obvious rejections. Claude is still the final judge for
 * anything that slips through.
 */
const LOCATION_BLOCKER_PATTERNS = [
  /open to candidates? (only )?in (the )?(usa|u\.?s\.?|united states|canada|uk|united kingdom)\b/i,
  /candidates? must be (based|located|residents?|citizens?) in (the )?(usa|u\.?s\.?|united states|canada|uk)\b/i,
  /must be authorized to work in (the )?(usa|u\.?s\.?|united states|canada|uk)\b/i,
  /(must|need to) (reside|live|be based) in (the )?(usa|u\.?s\.?|united states|north america)\b/i,
  /\b(pst|pacific|est|eastern|cst|central) (time|timezone|time zone|hours?) (required|only)\b/i,
  /\bu\.?s\.? (residents?|citizens?) only\b/i,
  /\bnorth america(n)? (only|residents?)\b/i,
];

const LOCATION_ACCEPTORS = [
  'remote', 'fully remote', 'worldwide', 'global',
  'europe', ' eu ', 'emea', 'spain', 'cet',
  'european timezone', 'european hours', 'work from anywhere',
];

const JUNIOR_PATTERNS = [
  /\bjunior\b/i, /\bentry.level\b/i, /\bintern(ship)?\b/i,
  /\btrainee\b/i, /\bgraduate\b/i,
];

const TAG_KEYWORDS = [
  'Vue.js', 'Vue 3', 'TypeScript', 'Tailwind', 'Pinia', 'Vuex',
  'Vite', 'Vitest', 'Capacitor', 'Ionic', 'Composition API',
  'Claude Code', 'MCP', 'Nuxt', 'GraphQL', 'Node.js',
];

// Monday run uses a wider window to bridge the weekend gap.
const IS_MONDAY = new Date().getUTCDay() === 1;
const MAX_AGE_MS = (IS_MONDAY ? 168 : 96) * 60 * 60 * 1000;
const DATE_POSTED = IS_MONDAY ? 'week' : '3days';

// --- Fetchers ----------------------------------------------------------------

async function fetchJSearch(query, country = null) {
  const key = process.env.JSEARCH_KEY;
  if (!key) {
    console.warn('[jsearch] JSEARCH_KEY missing — skipping');
    return [];
  }
  const url = new URL('https://jsearch.p.rapidapi.com/search');
  url.searchParams.set('query', query);
  url.searchParams.set('num_pages', '1');
  url.searchParams.set('date_posted', DATE_POSTED);
  url.searchParams.set('employment_types', 'FULLTIME');
  if (country) url.searchParams.set('country', country);
  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    });
    if (!res.ok) {
      console.warn(`[jsearch ${country ?? 'global'}] ${query} → ${res.status}`);
      return [];
    }
    const json = await res.json();
    return (json.data ?? []).map((j) => ({
      source: 'jsearch',
      title: j.job_title ?? '',
      company: j.employer_name ?? '',
      companyLogo: j.employer_logo ?? undefined,
      location: [j.job_city, j.job_country].filter(Boolean).join(', ') || 'Remote',
      remotePolicy: j.job_is_remote ? 'remote' : 'uncertain',
      isRemoteStructured: j.job_is_remote === true,
      postedAt: j.job_posted_at_datetime_utc ?? new Date().toISOString(),
      salaryMin: j.job_min_salary ?? undefined,
      salaryMax: j.job_max_salary ?? undefined,
      applyUrl: j.job_apply_link ?? '',
      rawDescription: j.job_description ?? '',
    }));
  } catch (err) {
    console.warn(`[jsearch] ${query} → ${err.message}`);
    return [];
  }
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function extractTag(item, tag) {
  // Handles both <tag>value</tag> and <tag><![CDATA[value]]></tag>.
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, 'i');
  const m = item.match(re);
  if (!m) return '';
  return (m[1] ?? m[2] ?? '').trim();
}

async function fetchWeWorkRemotely() {
  // The "remote-programming-jobs" category is the narrowest feed that still
  // reliably carries Vue postings. WWR doesn't expose a JSON API, just RSS,
  // but the feed shape has been stable for years so a regex parse is fine.
  const url = 'https://weworkremotely.com/categories/remote-programming-jobs.rss';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)',
      },
    });
    if (!res.ok) {
      console.warn(`[wwr] ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const all = items.map((item) => {
      const title = decodeHtmlEntities(extractTag(item, 'title'));
      const region = decodeHtmlEntities(extractTag(item, 'region'));
      const link = extractTag(item, 'link');
      const pubDate = extractTag(item, 'pubDate');
      const descRaw = decodeHtmlEntities(extractTag(item, 'description'));
      // WWR often prefixes "Company: Title" — split on the first colon.
      const colonIdx = title.indexOf(':');
      const company = colonIdx > 0 ? title.slice(0, colonIdx).trim() : 'Unknown';
      const jobTitle = colonIdx > 0 ? title.slice(colonIdx + 1).trim() : title;
      const descWithLocation = `${descRaw}\n\nLocation: ${region}`;
      return {
        source: 'wwr',
        title: jobTitle,
        company,
        companyLogo: undefined,
        location: region || 'Remote',
        remotePolicy: 'remote',
        isRemoteStructured: true,
        postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        salaryMin: undefined,
        salaryMax: undefined,
        applyUrl: link,
        rawDescription: descWithLocation,
      };
    });
    return all.filter((raw) => {
      const haystack = `${raw.title} ${stripHtml(raw.rawDescription)}`.toLowerCase();
      return VUE_KEYWORDS.some((k) => haystack.includes(k));
    });
  } catch (err) {
    console.warn(`[wwr] ${err.message}`);
    return [];
  }
}

async function fetchRemoteOk() {
  // RemoteOK requires a descriptive User-Agent and a backlink in the
  // dashboard per their ToS. The first array element is a legal/meta
  // notice, the rest are real jobs.
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: {
        'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)',
      },
    });
    if (!res.ok) {
      console.warn(`[remoteok] ${res.status}`);
      return [];
    }
    const arr = await res.json();
    const jobs = Array.isArray(arr) ? arr.slice(1) : [];
    const all = jobs.map((j) => {
      const descWithLocation = `${j.description ?? ''}\n\nLocation: ${j.location ?? ''}`;
      return {
        source: 'remoteok',
        title: j.position ?? '',
        company: j.company ?? '',
        companyLogo: j.company_logo ?? j.logo ?? undefined,
        location: j.location || 'Remote',
        // RemoteOK's whole raison d'être is remote, so every posting is
        // remote-friendly by definition.
        remotePolicy: 'remote',
        isRemoteStructured: true,
        postedAt: j.date
          ? new Date(j.date).toISOString()
          : j.epoch
            ? new Date(j.epoch * 1000).toISOString()
            : new Date().toISOString(),
        salaryMin: typeof j.salary_min === 'number' ? j.salary_min : undefined,
        salaryMax: typeof j.salary_max === 'number' ? j.salary_max : undefined,
        applyUrl: j.apply_url ?? j.url ?? '',
        rawDescription: descWithLocation,
      };
    });
    // Pre-filter for Vue to avoid inflating the reject counters with
    // the ~95% of RemoteOK that isn't frontend at all.
    return all.filter((raw) => {
      const haystack = `${raw.title} ${stripHtml(raw.rawDescription)}`.toLowerCase();
      return VUE_KEYWORDS.some((k) => haystack.includes(k));
    });
  } catch (err) {
    console.warn(`[remoteok] ${err.message}`);
    return [];
  }
}

async function fetchJobicy() {
  // Jobicy's `tag=vue` actually does server-side filtering (unlike most
  // other boards where we have to pull the full feed and filter locally).
  try {
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50&tag=vue');
    if (!res.ok) {
      console.warn(`[jobicy] ${res.status}`);
      return [];
    }
    const json = await res.json();
    return (json.jobs ?? []).map((j) => {
      const geo = j.jobGeo ?? '';
      const descWithLocation = `${j.jobDescription ?? ''}\n\nLocation: ${geo}`;
      return {
        source: 'jobicy',
        title: j.jobTitle ?? '',
        company: j.companyName ?? '',
        companyLogo: j.companyLogo ?? undefined,
        location: geo || 'Remote',
        remotePolicy: 'remote',
        isRemoteStructured: true,
        postedAt: j.pubDate ?? new Date().toISOString(),
        salaryMin: typeof j.annualSalaryMin === 'number' ? j.annualSalaryMin : undefined,
        salaryMax: typeof j.annualSalaryMax === 'number' ? j.annualSalaryMax : undefined,
        applyUrl: j.url ?? '',
        rawDescription: descWithLocation,
      };
    });
  } catch (err) {
    console.warn(`[jobicy] ${err.message}`);
    return [];
  }
}

async function fetchArbeitnow() {
  const url = 'https://www.arbeitnow.com/api/job-board-api';
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[arbeitnow] ${res.status}`);
      return [];
    }
    const json = await res.json();
    const all = (json.data ?? []).map((j) => {
      const locationLabel = j.location || (j.remote ? 'Remote' : '');
      const descWithLocation = `${j.description ?? ''}\n\nLocation: ${locationLabel}`;
      return {
        source: 'arbeitnow',
        title: j.title ?? '',
        company: j.company_name ?? '',
        companyLogo: undefined,
        location: locationLabel || 'EU',
        remotePolicy: j.remote ? 'remote' : 'uncertain',
        isRemoteStructured: j.remote === true,
        postedAt: j.created_at
          ? new Date(j.created_at * 1000).toISOString()
          : new Date().toISOString(),
        salaryMin: undefined,
        salaryMax: undefined,
        applyUrl: j.url ?? '',
        rawDescription: descWithLocation,
      };
    });
    // Client-side Vue pre-filter — Arbeitnow returns 100+ mixed jobs and
    // we don't want the reject counters inflated with non-Vue noise.
    return all.filter((raw) => {
      const haystack = `${raw.title} ${stripHtml(raw.rawDescription)}`.toLowerCase();
      return VUE_KEYWORDS.some((k) => haystack.includes(k));
    });
  } catch (err) {
    console.warn(`[arbeitnow] ${err.message}`);
    return [];
  }
}

// --- Stage 1: hard filters ---------------------------------------------------

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function passesHardFilters(raw) {
  const title = raw.title.toLowerCase();
  const desc = stripHtml(raw.rawDescription).toLowerCase();
  const haystack = `${title} ${desc}`;

  // F1: Vue stack
  const hasVue = VUE_KEYWORDS.some((k) => haystack.includes(k));
  if (!hasVue) return { ok: false, reason: 'no-vue' };

  // F2: location
  // Always reject if there's an explicit blocker, even when the structured
  // flag says remote — sometimes the platform says "remote" but the JD body
  // clarifies "US only".
  const blockedByString = LOCATION_BLOCKERS.some((k) => desc.includes(k));
  const blockedByPattern = LOCATION_BLOCKER_PATTERNS.some((re) => re.test(desc));
  if (blockedByString || blockedByPattern) return { ok: false, reason: 'blocked-location' };
  // Trust the source's structured signal first (JSearch gives us job_is_remote
  // as a boolean). Only fall back to keyword matching when the source doesn't
  // know — many JDs never literally say "remote" in the description body even
  // when the role IS remote.
  const acceptedByKeyword = LOCATION_ACCEPTORS.some(
    (k) => desc.includes(k) || title.includes(k.trim())
  );
  const accepted = raw.isRemoteStructured === true || acceptedByKeyword;
  if (!accepted) return { ok: false, reason: 'no-remote-signal' };

  // F3: freshness
  const age = Date.now() - new Date(raw.postedAt).getTime();
  if (!Number.isFinite(age) || age > MAX_AGE_MS) return { ok: false, reason: 'stale' };

  // F4: anti-junior (title-only)
  if (JUNIOR_PATTERNS.some((re) => re.test(raw.title))) {
    return { ok: false, reason: 'junior' };
  }

  return { ok: true };
}

// --- Stage 2: dedupe ---------------------------------------------------------

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function makeId(raw) {
  const key = `${normalize(raw.company)}__${normalize(raw.title)}`;
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
}

// --- Tagging -----------------------------------------------------------------

function extractTags(desc) {
  const haystack = desc.toLowerCase();
  return TAG_KEYWORDS.filter((tag) => haystack.includes(tag.toLowerCase())).slice(0, 3);
}

// --- Stage 3: Claude CLI scoring --------------------------------------------

function hasClaudeCli() {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Warm up the Claude CLI with a trivial call so the first real scoring
 * doesn't eat the cold-start latency (auth handshake, session init). If
 * this fails we still continue — the per-job call will just retry with
 * its own timeout.
 */
// Scoring is a simple extract-and-classify task, so we use Haiku. It burns
// far less of the Max quota than Sonnet/Opus with no measurable quality loss
// on this prompt — keeps coding-session headroom free for the user.
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

function warmupClaude() {
  try {
    execFileSync('claude', ['--model', CLAUDE_MODEL, '-p', 'Reply with the single word: ok'], {
      encoding: 'utf8',
      timeout: 180_000,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    console.log('  [claude warmup] ok');
  } catch (err) {
    console.warn(`  [claude warmup] failed: ${err.message}`);
  }
}

function fallbackScore(raw) {
  // Deterministic heuristic used when the `claude` CLI is unavailable
  // (e.g. local dev without Max, or OAuth token missing). Keeps the pipeline
  // running end-to-end so the dashboard still has data.
  const desc = raw.rawDescription.toLowerCase();
  const hasTS = desc.includes('typescript');
  const hasAI = /claude|copilot|cursor|llm|mcp|ai.assisted/.test(desc);
  const aiBonus = hasAI ? 15 : 0;
  const stack = desc.includes('vue') && (desc.includes('nuxt') || desc.includes('vue 3')) ? 90 : 70;
  const overall = Math.min(100, Math.round(stack * 0.7 + (hasTS ? 15 : 5) + aiBonus));
  return {
    overall,
    stack_match: stack,
    location_ok: true,
    seniority_fit: 'senior',
    ai_bonus: aiBonus,
    reason: 'Heuristic score (claude CLI unavailable). Regex-based stack match; not LLM-judged.',
    red_flags: [],
  };
}

function scoreWithClaude(raw, scoringInstructions) {
  const jd = [
    `# ${raw.title}`,
    `Company: ${raw.company}`,
    `Location: ${raw.location}`,
    `Posted: ${raw.postedAt}`,
    '',
    // 2500 char is enough to capture stack + location signals; the rest of
    // a JD is usually fluff (benefits, about-us, values) that just inflates
    // token usage without changing the score.
    stripHtml(raw.rawDescription).slice(0, 2500),
  ].join('\n');

  // NOTE: we inline the scoring instructions directly instead of asking Claude
  // to Read() the file. In non-interactive CI mode the CLI won't auto-approve
  // filesystem tools, so "read this file and then score" silently fails.
  const prompt = `${scoringInstructions}\n\n---\n\n${jd}`;

  try {
    const stdout = execFileSync('claude', ['--model', CLAUDE_MODEL, '-p', prompt], {
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const match = stdout.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON in claude output');
    const parsed = JSON.parse(match[0]);
    return {
      overall: Number(parsed.overall) || 0,
      stack_match: Number(parsed.stack_match) || 0,
      location_ok: Boolean(parsed.location_ok),
      seniority_fit: parsed.seniority_fit ?? 'senior',
      ai_bonus: Number(parsed.ai_bonus) || 0,
      reason: String(parsed.reason ?? '').slice(0, 400),
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.slice(0, 6) : [],
    };
  } catch (err) {
    // Show whatever the CLI actually wrote to stderr — this is the only
    // way to diagnose CI failures where all we see is "Command failed".
    const stderr = err.stderr ? String(err.stderr).trim().slice(0, 600) : '';
    const stdout = err.stdout ? String(err.stdout).trim().slice(0, 300) : '';
    console.warn(`[claude] "${raw.title}" → ${err.message}`);
    if (stderr) console.warn(`  stderr: ${stderr}`);
    if (stdout) console.warn(`  stdout: ${stdout}`);
    console.warn('  falling back to heuristic');
    return fallbackScore(raw);
  }
}

// --- Main --------------------------------------------------------------------

async function main() {
  console.log(`vuenture daily fetch — window=${IS_MONDAY ? '7d' : '96h'}`);

  // Stage 0: fetch
  const rawAll = [];
  for (const q of GLOBAL_QUERIES) {
    const results = await fetchJSearch(q);
    console.log(`  jsearch [global] "${q}" → ${results.length}`);
    rawAll.push(...results);
  }
  for (const q of SPAIN_QUERIES) {
    const results = await fetchJSearch(q, 'es');
    console.log(`  jsearch [es] "${q}" → ${results.length}`);
    rawAll.push(...results);
  }
  const wwrResults = await fetchWeWorkRemotely();
  console.log(`  wwr vue-filtered → ${wwrResults.length}`);
  rawAll.push(...wwrResults);
  const remoteOkResults = await fetchRemoteOk();
  console.log(`  remoteok vue-filtered → ${remoteOkResults.length}`);
  rawAll.push(...remoteOkResults);
  const jobicyResults = await fetchJobicy();
  console.log(`  jobicy tag=vue → ${jobicyResults.length}`);
  rawAll.push(...jobicyResults);
  const arbeitnowResults = await fetchArbeitnow();
  console.log(`  arbeitnow vue-filtered → ${arbeitnowResults.length}`);
  rawAll.push(...arbeitnowResults);
  // Stage 1: hard filters
  const rejected = { 'no-vue': 0, 'blocked-location': 0, 'no-remote-signal': 0, stale: 0, junior: 0 };
  const survived = [];
  for (const raw of rawAll) {
    const verdict = passesHardFilters(raw);
    if (!verdict.ok) {
      rejected[verdict.reason]++;
      continue;
    }
    survived.push(raw);
  }
  console.log(`  hard filters: kept ${survived.length}, rejected`, rejected);

  // Stage 2: dedupe
  const seen = new Map();
  for (const raw of survived) {
    const id = makeId(raw);
    if (!seen.has(id)) seen.set(id, { ...raw, id });
  }
  const deduped = Array.from(seen.values());
  console.log(`  deduped: ${deduped.length}`);

  // Stage 3: score
  const useCli = hasClaudeCli();
  console.log(`  scoring with ${useCli ? 'claude CLI' : 'heuristic fallback'}`);
  if (useCli) warmupClaude();
  const scoringInstructions = fs.readFileSync(
    path.join(ROOT, 'scripts', 'scoringPrompt.md'),
    'utf8'
  );
  const scored = deduped.map((raw) => {
    const score = useCli ? scoreWithClaude(raw, scoringInstructions) : fallbackScore(raw);
    return {
      id: raw.id,
      title: raw.title,
      company: raw.company,
      companyLogo: raw.companyLogo,
      location: raw.location,
      remotePolicy: raw.remotePolicy,
      postedAt: raw.postedAt,
      salaryMin: raw.salaryMin,
      salaryMax: raw.salaryMax,
      tags: extractTags(raw.rawDescription),
      applyUrl: raw.applyUrl,
      source: raw.source,
      rawDescription: stripHtml(raw.rawDescription).slice(0, 2000),
      score,
    };
  });

  // Stage 3.5 — split by Claude's location verdict.
  // location_ok === false → "needs review" safety-net bucket (hidden by
  // default in the UI, revealable via toggle). Everything else goes to the
  // primary list.
  const primary = [];
  const needsReview = [];
  for (const j of scored) {
    if (j.score.location_ok === false) {
      needsReview.push(j);
    } else {
      primary.push(j);
    }
  }
  console.log(`  split by location_ok: ${primary.length} primary / ${needsReview.length} needs review`);

  // Sort each bucket by overall desc
  primary.sort((a, b) => b.score.overall - a.score.overall);
  needsReview.sort((a, b) => b.score.overall - a.score.overall);

  // Write
  const publicDir = path.join(ROOT, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  const out = {
    fetchedAt: new Date().toISOString(),
    jobs: primary,
    needsReview,
  };
  fs.writeFileSync(path.join(publicDir, 'jobs.json'), JSON.stringify(out, null, 2));
  console.log(`✓ wrote public/jobs.json — ${primary.length} primary, ${needsReview.length} needs review`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
