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

// NOTE on Arbeitnow: a previous version of this script also called the
// Arbeitnow job-board API as a fallback. In practice their `tags[]=vue` query
// parameter is silently ignored server-side, so the endpoint returns a generic
// EU job feed (~0% Vue matches) that just inflated the reject counters. Until
// we find a working text/tag filter, Arbeitnow is disabled — JSearch's free
// tier (200 req/month) is enough for the daily run.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- Config (mirrors src/config/profile.ts — keep in sync) ------------------

const QUERIES = [
  'Senior Vue.js developer remote',
  'Senior Vue frontend developer remote Europe',
  'Vue 3 TypeScript senior developer remote',
  'Vue.js Nuxt.js senior frontend remote EU',
  'Senior frontend engineer Vue Tailwind Pinia remote',
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
  'Vue.js', 'Vue 3', 'Nuxt', 'TypeScript', 'Tailwind', 'Pinia',
  'Vite', 'Vitest', 'Capacitor', 'Ionic', 'GraphQL', 'Node.js',
];

// Monday run uses a wider window to bridge the weekend gap.
const IS_MONDAY = new Date().getUTCDay() === 1;
const MAX_AGE_MS = (IS_MONDAY ? 168 : 96) * 60 * 60 * 1000;
const DATE_POSTED = IS_MONDAY ? 'week' : '3days';

// --- Fetchers ----------------------------------------------------------------

async function fetchJSearch(query) {
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
  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    });
    if (!res.ok) {
      console.warn(`[jsearch] ${query} → ${res.status}`);
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
function warmupClaude() {
  try {
    execFileSync('claude', ['-p', 'Reply with the single word: ok'], {
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

function scoreWithClaude(raw, promptPath) {
  const jd = [
    `# ${raw.title}`,
    `Company: ${raw.company}`,
    `Location: ${raw.location}`,
    `Posted: ${raw.postedAt}`,
    '',
    stripHtml(raw.rawDescription).slice(0, 6000),
  ].join('\n');

  const prompt = `Read the scoring instructions at ${promptPath} and score the job below. Return strict JSON only.\n\n---\n\n${jd}`;

  try {
    const stdout = execFileSync('claude', ['-p', prompt], {
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
  for (const q of QUERIES) {
    const results = await fetchJSearch(q);
    console.log(`  jsearch "${q}" → ${results.length}`);
    rawAll.push(...results);
  }
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
  const promptPath = path.join(ROOT, 'scripts', 'scoringPrompt.md');
  const scored = deduped.map((raw) => {
    const score = useCli ? scoreWithClaude(raw, promptPath) : fallbackScore(raw);
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
