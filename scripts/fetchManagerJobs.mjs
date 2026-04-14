#!/usr/bin/env node
/**
 * Manager jobs — daily fetch pipeline (ATS-only).
 *
 * Runs in GitHub Actions (or locally with `npm run fetch-manager-jobs`).
 *
 * Pipeline:
 *   1. Hit ATS endpoints for all companies in the manager watchlist
 *   2. Filter by manager title regex
 *   3. Hard filters (location / freshness)
 *   4. Deduplicate by normalize(company + title)
 *   5. Score with `claude` CLI
 *   6. Write public/manager-jobs.json
 *
 * Secrets expected (env):
 *   CLAUDE_CODE_OAUTH_TOKEN    Claude CLI OAuth token (Max subscription)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
import { fileURLToPath } from 'node:url';

import {
  MANAGER_SKILLS,
  MANAGER_TITLE_RE_SOURCE,
  MANAGER_LOCATION_BLOCKERS,
  MANAGER_LOCATION_ACCEPTORS,
  MANAGER_TAG_KEYWORDS,
} from '../src/config/manager.shared.js';
import { MANAGER_COMPANIES_WATCHLIST } from '../src/config/manager-companies.shared.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─── Regex ──────────────────────────────────────────────────────────────────

const MANAGER_TITLE_RE = new RegExp(MANAGER_TITLE_RE_SOURCE, 'i');

// Monday gives a wider freshness window (168h vs 96h) to catch weekend posts
const IS_MONDAY = new Date().getDay() === 1;
const MAX_AGE_MS = (IS_MONDAY ? 168 : 96) * 3_600_000;

// Location blocker patterns (regex)
const LOCATION_BLOCKER_PATTERNS = [
  /\b(pst|pacific)\s*(time\s*)?(hours?\s*)?only\b/i,
  /\bus\s*(citizens?|residents?|persons?)\s*only\b/i,
  /\bmust\s*be\s*(based|located)\s*in\s*(the\s*)?(us|usa|united\s*states|uk|united\s*kingdom|canada)\b/i,
  // Hybrid / in-office patterns (full-remote only — Séverine is Valencia-based)
  /\bhybrid\s+(work|working|role|position|model|setup|policy|arrangement|schedule|environment)\b/i,
  /\b(work|working|role|position|model|setup|policy|schedule)\s*:?\s*hybrid\b/i,
  /\bhybrid\s*\([^)]*(office|days?|week)[^)]*\)/i,
  /\b\d+\s*days?\s*(per|a|\/)\s*week\s*(in|at)\s*(the\s*)?office\b/i,
  /\b\d+\s*days?\s*(on[-\s]?site|in[-\s]?office|in\s*the\s*office)\b/i,
  /\bin[-\s]?office\s+\d+\s*days?\b/i,
  /\bmust\s+be\s+able\s+to\s+(come|commute)\s+to\s+(the\s+)?office\b/i,
  // Remote gated to a single non-Spain country/region
  /\bremote\s*[,\-–()\s]+(united\s*kingdom|uk|ireland|united\s*states|\bus\b|usa|canada|noram|latam|apac|australia|new\s*zealand|germany|netherlands|france|portugal|italy|poland|sweden|norway|denmark|finland|czech(?:ia)?)\b/i,
  /\b(united\s*kingdom|uk|us|usa|united\s*states|noram|canada|latam|apac)\s*[-–]?\s*remote\b/i,
  /\ball\s+(france|uk|united\s*kingdom|germany|netherlands|ireland|portugal|italy|poland)\s*\(\s*remote\s*\)/i,
  /\bremote\s*\(\s*(france|uk|united\s*kingdom|germany|netherlands|ireland|portugal|italy|poland|us|usa|united\s*states|noram|canada)\s*\)/i,
  /\bremote\s*in\s*(france|uk|united\s*kingdom|germany|netherlands|ireland|portugal|italy|poland|us|usa|united\s*states|noram|canada|ukraine)\b/i,
  /\bremote\s*[-–,]\s*(france|uk|united\s*kingdom|germany|netherlands|ireland|portugal|italy|poland|us|usa|united\s*states|noram|canada)\b/i,
];

// Locations that look like a single city/country without an explicit full-remote phrase
// → can't trust isRemoteStructured alone (some ATSes mark city-anchored roles as "remote").
const SINGLE_CITY_LOCATION_RE = /^[A-Za-zÀ-ÿ .'-]+(,\s*[A-Za-zÀ-ÿ .'-]+)?$/;

// Locations that are simply a non-Spain/non-EU-wide country
const COUNTRY_GATED_LOCATION_RE = /^(remote[,\s-]+)?(united\s*kingdom|uk|united\s*states|usa?|canada|australia|new\s*zealand|japan|india|singapore|brazil|mexico|argentina|noram|latam|apac|ireland|germany|netherlands|france|portugal|italy|poland|sweden|norway|denmark|finland)$/i;

// Strong positive signal: a full-remote keyword must appear somewhere.
const FULL_REMOTE_REQUIRED_PATTERNS = [
  /\bfull(y|-)?\s*remote\b/i,
  /\bremote[- ]first\b/i,
  /\b100\s*%\s*remote\b/i,
  /\bwork\s+from\s+anywhere\b/i,
  /\banywhere\s+in\s+(europe|the\s+eu|emea|the\s+world)\b/i,
  /\bremote\s*[-–,()]\s*(europe|eu|emea|spain|worldwide|global)\b/i,
  /\bremote\s+in\s+(europe|the\s+eu|emea|spain)\b/i,
  /\bremote\s+from\s+(spain|europe|anywhere)\b/i,
  /\bworldwide\s+remote\b/i,
  /\bteletrabajo\b/i,
  /\btélétravail\b/i,
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(s) {
  // Decode HTML entities first (Greenhouse sometimes double-encodes)
  const decoded = s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
  return decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

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

function mergeRawJobs(a, b) {
  const locationQuality = (v) => {
    if (!v || v === 'Remote') return 0;
    if (/^Remote\s*·/.test(v)) return 1;
    return 2;
  };
  const pickNewer = (va, vb) => {
    const ta = new Date(va).getTime();
    const tb = new Date(vb).getTime();
    if (!Number.isFinite(ta)) return vb;
    if (!Number.isFinite(tb)) return va;
    return tb > ta ? vb : va;
  };
  const pickLonger = (va, vb) => ((vb?.length ?? 0) > (va?.length ?? 0) ? vb : va);

  return {
    ...a,
    location: locationQuality(b.location) > locationQuality(a.location) ? b.location : a.location,
    remotePolicy: a.remotePolicy === 'remote' || b.remotePolicy === 'remote' ? 'remote' : a.remotePolicy,
    isRemoteStructured: a.isRemoteStructured || b.isRemoteStructured,
    postedAt: pickNewer(a.postedAt, b.postedAt),
    salaryMin: a.salaryMin ?? b.salaryMin,
    salaryMax: a.salaryMax ?? b.salaryMax,
    applyUrl: a.applyUrl || b.applyUrl,
    rawDescription: pickLonger(a.rawDescription, b.rawDescription),
  };
}

function extractTags(desc) {
  const haystack = desc.toLowerCase();
  return MANAGER_TAG_KEYWORDS.filter((tag) => haystack.includes(tag.toLowerCase())).slice(0, 3);
}

// ─── ATS Adapters ───────────────────────────────────────────────────────────

function atsGreenhouse(slug) {
  return async (companyName) => {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)' },
    });
    if (!res.ok) return [];
    const { jobs = [] } = await res.json();
    return jobs.filter((j) => MANAGER_TITLE_RE.test(j.title)).map((j) => ({
      source: 'watchlist',
      title: j.title ?? '',
      company: companyName,
      location: j.location?.name || 'Remote',
      remotePolicy: /remote/i.test(j.location?.name ?? '') ? 'remote' : 'uncertain',
      isRemoteStructured: /remote/i.test(j.location?.name ?? ''),
      postedAt: j.updated_at ? new Date(j.updated_at).toISOString() : new Date().toISOString(),
      salaryMin: undefined,
      salaryMax: undefined,
      applyUrl: j.absolute_url ?? '',
      rawDescription: `${j.title}\n\n${stripHtml(j.content ?? '')}\n\nLocation: ${j.location?.name ?? ''}`,
    }));
  };
}

function atsAshby(slug) {
  return async (companyName) => {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)' },
    });
    if (!res.ok) return [];
    const { jobs = [] } = await res.json();
    return jobs.filter((j) => MANAGER_TITLE_RE.test(j.title)).map((j) => {
      const loc = j.location || '';
      const secondaryLocs = (j.secondaryLocations ?? []).map((s) => s.location).join(', ');
      const fullLoc = secondaryLocs ? `${loc} (+ ${secondaryLocs})` : loc;
      return {
        source: 'watchlist',
        title: j.title ?? '',
        company: companyName,
        location: fullLoc || 'Remote',
        remotePolicy: j.isRemote ? 'remote' : 'uncertain',
        isRemoteStructured: j.isRemote === true,
        postedAt: j.publishedDate ? new Date(j.publishedDate).toISOString() : new Date().toISOString(),
        salaryMin: undefined,
        salaryMax: undefined,
        applyUrl: j.jobUrl ?? '',
        rawDescription: `${j.title}\n\n${stripHtml(j.descriptionHtml ?? '')}\n\nLocation: ${fullLoc}`,
      };
    });
  };
}

function atsLever(slug) {
  return async (companyName) => {
    const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)' },
    });
    if (!res.ok) return [];
    const postings = await res.json();
    if (!Array.isArray(postings)) return [];
    return postings.filter((j) => MANAGER_TITLE_RE.test(j.text)).map((j) => {
      const loc = j.categories?.location ?? '';
      return {
        source: 'watchlist',
        title: j.text ?? '',
        company: companyName,
        location: loc || 'Remote',
        remotePolicy: /remote/i.test(loc) ? 'remote' : 'uncertain',
        isRemoteStructured: /remote/i.test(loc),
        postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
        salaryMin: undefined,
        salaryMax: undefined,
        applyUrl: j.hostedUrl ?? '',
        rawDescription: `${j.text}\n\n${stripHtml(j.description ?? '')}\n\nLocation: ${loc}`,
      };
    });
  };
}

function atsRecruitee(slug) {
  return async (companyName) => {
    const url = `https://${slug}.recruitee.com/api/offers/`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)' },
    });
    if (!res.ok) return [];
    const { offers = [] } = await res.json();
    return offers.filter((j) => MANAGER_TITLE_RE.test(j.title)).map((j) => {
      const loc = j.location || '';
      return {
        source: 'watchlist',
        title: j.title ?? '',
        company: companyName,
        location: loc || 'Remote',
        remotePolicy: /remote/i.test(loc) ? 'remote' : 'uncertain',
        isRemoteStructured: /remote/i.test(loc),
        postedAt: j.created_at ? new Date(j.created_at).toISOString() : new Date().toISOString(),
        salaryMin: undefined,
        salaryMax: undefined,
        applyUrl: j.careers_url ?? '',
        rawDescription: `${j.title}\n\n${stripHtml(j.description ?? '')}\n\nLocation: ${loc}`,
      };
    });
  };
}

const ATS_ADAPTERS = { greenhouse: atsGreenhouse, ashby: atsAshby, lever: atsLever, recruitee: atsRecruitee };

// ─── Fetch companies ────────────────────────────────────────────────────────

async function fetchCompanies() {
  const results = [];
  for (const entry of MANAGER_COMPANIES_WATCHLIST) {
    const adapterFactory = ATS_ADAPTERS[entry.ats];
    if (!adapterFactory) {
      console.warn(`[watchlist] unknown ATS "${entry.ats}" for ${entry.name}`);
      continue;
    }
    try {
      const adapter = adapterFactory(entry.slug);
      const jobs = await adapter(entry.name);
      console.log(`  watchlist ${entry.name} (${entry.ats}/${entry.slug}) → ${jobs.length} manager roles`);
      results.push(...jobs);
    } catch (err) {
      console.warn(`[watchlist] ${entry.name} → ${err.message}`);
    }
  }
  return results;
}

// ─── Hard filters ───────────────────────────────────────────────────────────

function passesHardFilters(raw) {
  const desc = stripHtml(raw.rawDescription).toLowerCase();
  const location = (raw.location ?? '').toLowerCase().trim();

  // F2a: location blockers (hybrid / on-site / geo exclusions)
  const blockedByString = MANAGER_LOCATION_BLOCKERS.some((k) => desc.includes(k) || location.includes(k));
  const blockedByPattern = LOCATION_BLOCKER_PATTERNS.some((re) => re.test(desc) || re.test(location));
  if (blockedByString || blockedByPattern) return { ok: false, reason: 'blocked-location' };

  // F2b: reject when the location field itself pins the role to a non-Spain country.
  //      (e.g. "Dublin; Ireland", "Paris", "All France (remote)", "Remote, United Kingdom")
  if (COUNTRY_GATED_LOCATION_RE.test(location.replace(/^remote[,\s-]+/, ''))) {
    return { ok: false, reason: 'country-gated' };
  }

  // F2c: REQUIRE explicit full-remote signal. No city/country name on its own.
  const title = raw.title.toLowerCase();
  const haystack = `${title}\n${location}\n${desc}`;
  const keywordHit = MANAGER_LOCATION_ACCEPTORS.some((k) => haystack.includes(k));
  const patternHit = FULL_REMOTE_REQUIRED_PATTERNS.some((re) => re.test(haystack));

  // ATS isRemote flag is only trusted if not paired with a single-city/country location
  // (some ATSes — Ashby at Pennylane — mark Paris-anchored roles as isRemote=true).
  const locationLooksAnchored =
    location !== '' &&
    !location.includes('remote') &&
    !location.includes('anywhere') &&
    !location.includes('worldwide') &&
    SINGLE_CITY_LOCATION_RE.test(raw.location ?? '');
  const trustStructuredFlag = raw.isRemoteStructured === true && !locationLooksAnchored;

  const accepted = trustStructuredFlag || keywordHit || patternHit;
  if (!accepted) return { ok: false, reason: 'no-remote-signal' };

  // F3: freshness
  const age = Date.now() - new Date(raw.postedAt).getTime();
  if (!Number.isFinite(age) || age > MAX_AGE_MS) return { ok: false, reason: 'stale' };

  return { ok: true };
}

// ─── Scoring ────────────────────────────────────────────────────────────────

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

function hasClaudeCli() {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

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

function buildSkillsContext(skills) {
  const levels = { expert: [], strong: [], basic: [], learning: [], none: [] };
  for (const [skill, level] of Object.entries(skills)) {
    const label = skill.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (levels[level]) levels[level].push(label);
  }
  const lines = [];
  if (levels.expert.length) lines.push(`**Expert** (differentiator, +10 each): ${levels.expert.join(', ')}`);
  if (levels.strong.length) lines.push(`**Strong** (production confidence, +5 each): ${levels.strong.join(', ')}`);
  if (levels.basic.length) lines.push(`**Basic** (can contribute, +2 each): ${levels.basic.join(', ')}`);
  if (levels.learning.length) lines.push(`**Learning** (small penalty instead of red flag): ${levels.learning.join(', ')}`);
  if (levels.none.length) lines.push(`**None** (red flag if core requirement): ${levels.none.join(', ')}`);
  return lines.join('\n');
}

function fallbackScore(raw) {
  const desc = raw.rawDescription.toLowerCase();
  const expertHits = ['product', 'project', 'agile', 'scrum', 'jira', 'confluence', 'roadmap', 'stakeholder'].filter(s => desc.includes(s)).length;
  const strongHits = ['figma', 'zapier', 'claude', 'b2b', 'saas'].filter(s => desc.includes(s)).length;
  const stack = Math.min(100, expertHits * 10 + strongHits * 5);
  return {
    overall: Math.min(100, stack),
    stack_match: stack,
    location_ok: true,
    seniority_fit: 'senior',
    reason: 'Heuristic score (claude CLI unavailable). Regex-based skill match; not LLM-judged.',
    red_flags: [],
  };
}

async function scoreWithClaude(raw, scoringInstructions) {
  const jd = [
    `# ${raw.title}`,
    `Company: ${raw.company}`,
    `Location: ${raw.location}`,
    `Posted: ${raw.postedAt}`,
    '',
    stripHtml(raw.rawDescription).slice(0, 2500),
  ].join('\n');

  const prompt = `${scoringInstructions}\n\n---\n\n${jd}`;

  try {
    const { stdout } = await execFileAsync('claude', ['--model', CLAUDE_MODEL, '-p', prompt], {
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
      reason: String(parsed.reason ?? '').slice(0, 400),
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.slice(0, 6) : [],
    };
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim().slice(0, 600) : '';
    const stdout = err.stdout ? String(err.stdout).trim().slice(0, 300) : '';
    console.warn(`[claude] "${raw.title}" → ${err.message}`);
    if (stderr) console.warn(`  stderr: ${stderr}`);
    if (stdout) console.warn(`  stdout: ${stdout}`);
    console.warn('  falling back to heuristic');
    return fallbackScore(raw);
  }
}

// Concurrency pool — run `worker(item, index)` with at most `limit` in flight.
async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`manager jobs fetch — window=${IS_MONDAY ? '7d' : '96h'}`);

  // Stage 0: fetch from ATS
  const rawAll = await fetchCompanies();
  console.log(`  total from ATS → ${rawAll.length} manager roles`);

  // Stage 1: hard filters
  const rejected = { 'blocked-location': 0, 'country-gated': 0, 'no-remote-signal': 0, stale: 0 };
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
    const existing = seen.get(id);
    if (!existing) {
      seen.set(id, { ...raw, id });
      continue;
    }
    seen.set(id, mergeRawJobs(existing, raw));
  }
  const deduped = Array.from(seen.values());
  console.log(`  deduped: ${deduped.length}`);

  // Stage 3: score
  const useCli = hasClaudeCli();
  console.log(`  scoring with ${useCli ? 'claude CLI' : 'heuristic fallback'}`);
  if (useCli) warmupClaude();
  const scoringTemplate = fs.readFileSync(
    path.join(ROOT, 'scripts', 'managerScoringPrompt.md'),
    'utf8'
  );
  const scoringInstructions = scoringTemplate.replace(
    '{{SKILLS_CONTEXT}}',
    buildSkillsContext(MANAGER_SKILLS)
  );
  const SCORING_CONCURRENCY = Number(process.env.MANAGER_SCORING_CONCURRENCY) || 4;
  if (useCli) console.log(`  scoring concurrency: ${SCORING_CONCURRENCY}`);
  let completed = 0;
  const scoreStart = Date.now();
  const scored = await runPool(deduped, useCli ? SCORING_CONCURRENCY : 1, async (raw) => {
    const score = useCli ? await scoreWithClaude(raw, scoringInstructions) : fallbackScore(raw);
    completed += 1;
    console.log(`  scored [${completed}/${deduped.length}] ${raw.company} — ${raw.title} → ${score.overall}`);
    return {
      id: raw.id,
      title: raw.title,
      company: raw.company,
      companyLogo: undefined,
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
  console.log(`  scoring finished in ${Math.round((Date.now() - scoreStart) / 1000)}s`);

  // Split by location verdict
  const primary = [];
  const needsReview = [];
  for (const j of scored) {
    if (j.score.location_ok === false) {
      needsReview.push(j);
    } else {
      primary.push(j);
    }
  }
  console.log(`  split: ${primary.length} primary / ${needsReview.length} needs review`);

  primary.sort((a, b) => b.score.overall - a.score.overall);
  needsReview.sort((a, b) => b.score.overall - a.score.overall);

  // Write
  const publicDir = path.join(ROOT, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  const out = { fetchedAt: new Date().toISOString(), jobs: primary, needsReview };
  fs.writeFileSync(path.join(publicDir, 'manager-jobs.json'), JSON.stringify(out, null, 2));
  console.log(`✓ wrote public/manager-jobs.json — ${primary.length} primary, ${needsReview.length} needs review`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
