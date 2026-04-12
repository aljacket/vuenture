#!/usr/bin/env node
/**
 * vuenture — daily job fetch pipeline.
 *
 * Runs in GitHub Actions (or locally with `npm run fetch-jobs`).
 *
 * Pipeline:
 *   1. Query JSearch + Arbeitnow + InfoJobs + Adzuna + companies watchlist
 *   2. Stage 1 — hard regex filters (Vue / location / freshness / anti-junior)
 *   3. Stage 2 — deduplicate by normalize(company + title)
 *   4. Stage 3 — pipe each survivor into `claude` CLI for scoring
 *   5. Sort by score.overall, write public/jobs.json
 *
 * Secrets expected (env):
 *   JSEARCH_KEY                RapidAPI key for JSearch
 *   INFOJOBS_CLIENT_ID         InfoJobs API app client ID
 *   INFOJOBS_CLIENT_SECRET     InfoJobs API app client secret
 *   ADZUNA_APP_ID              Adzuna API app ID
 *   ADZUNA_APP_KEY             Adzuna API app key
 *   CLAUDE_CODE_OAUTH_TOKEN    Claude CLI OAuth token (Max subscription)
 */

// NOTE on sources:
// - JSearch (RapidAPI): US-biased but with the best text search AND
//   aggregates Indeed/LinkedIn/Glassdoor/ZipRecruiter under the hood.
//   Multi-country queries (ES/IT/PT) hit national Indeed indexes.
// - vuejobs.com: the official Vue community job board. RSS feed at /feed,
//   ~90 items. Despite the domain, the feed is NOT Vue-only — it mixes
//   in generic Python/Java/.NET/Angular/QA posts — so F1 runs on it like
//   every other source.
// - Duunitori (FI): public JSON API at /api/v1/jobentries?search=vue.
//   Small (~20 items) and Finnish-language but it's the only Nordic
//   source with a real API — fills the Scandinavia gap left by JSearch.
// - WeWorkRemotely: the `remote-programming-jobs` RSS feed. Parsed with
//   regex — the feed shape is stable and the dep cost of a real XML
//   parser isn't worth it.
// - Arbeitnow: EU/Germany-focused feed (single page, ~100 jobs). Their
//   tags[]=vue query is broken server-side so we fetch the general feed
//   and filter for Vue client-side.
// - RemoteOK: public JSON feed (~100 jobs per request). Their tag=vue
//   filter returns nothing because jobs are tagged with generic labels
//   ("front end") rather than stack names, so we also filter client-side.
// - Jobicy: smaller feed but their `tag=vue` parameter does real
//   server-side filtering — cheap to keep in the loop.
//
// - InfoJobs (ES): the #1 Spanish job board. Public API with Basic Auth
//   (client_id + client_secret). List endpoint /api/1/offer returns
//   `requirementMin` (2500 chars) used as description. Keyword search
//   for vue/vuejs/vue.js with country=espana. Deduped internally.
//
// - Adzuna (ES): multi-country job search API with native Spain index.
//   Free tier, query-param auth (app_id + app_key). Searches for vue
//   in category=it-jobs. Note: description is truncated to ~500 chars.
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

import {
  SKILLS,
  JSEARCH_QUERIES,
  VUE_KEYWORDS,
  LOCATION_BLOCKERS,
  LOCATION_COUNTRY_BLOCKERS,
  LOCATION_ACCEPTORS,
  JUNIOR_TITLE_PATTERNS,
  TAG_KEYWORDS,
} from '../src/config/profile.shared.js';

import { COMPANIES_WATCHLIST } from '../src/config/companies.shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Build the dynamic skills context block that gets substituted into
 * scoringPrompt.md as {{SKILLS_CONTEXT}}. Groups ALL skills by level
 * so the LLM scores based on the full, current skills matrix.
 *
 * Adding or bumping a skill in SKILLS automatically changes scoring
 * on the next run — no prompt edits needed.
 */
function buildSkillsContext(skills) {
  const groups = { expert: [], strong: [], basic: [], learning: [], none: [] };
  for (const [name, level] of Object.entries(skills)) {
    const label = name.replace(/_/g, ' ');
    if (groups[level]) groups[level].push(label);
  }

  const lines = [];
  if (groups.expert.length) {
    lines.push(
      `- **Expert (differentiators — reward matches heavily):** ${groups.expert.join(', ')}. A role that matches multiple expert skills is the highest-value target. Each expert skill present in the JD adds +10 to \`stack_match\`.`
    );
  }
  if (groups.strong.length) {
    lines.push(
      `- **Strong (production confidence):** ${groups.strong.join(', ')}. Each strong skill present in the JD adds +5 to \`stack_match\`.`
    );
  }
  if (groups.basic.length) {
    lines.push(
      `- **Basic (can contribute, neutral):** ${groups.basic.join(', ')}. Neutral signal — no bonus or penalty. Only penalize (-10) if the role expects deep/senior expertise in these.`
    );
  }
  if (groups.learning.length) {
    lines.push(
      `- **Currently learning (mild positive):** ${groups.learning.join(', ')}. Jobs mentioning these as part of the role are neutral to slightly positive. Only penalize (-5) if deep expertise is expected from day one.`
    );
  }
  if (groups.none.length) {
    lines.push(
      `- **No experience (red flag if core stack):** ${groups.none.join(', ')}. Jobs requiring these as a MAJOR part of the work should be penalized -15 on \`overall\` and added to \`red_flags\`. Merely "nice to have" mentions are neutral.`
    );
  }
  return lines.join('\n');
}

/**
 * Regex blockers for gating phrases that substring matching can't catch.
 * These run as a cheap pre-filter before Claude scoring so we don't waste
 * CLI calls on obvious rejections. Claude is still the final judge for
 * anything that slips through. Kept local (not shared) because they are
 * only used by the hard-filter stage inside this script.
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

// Sources whose feed/search is Vue-only by construction. We trust their
// server-side filter and skip our local F1 Vue keyword check, otherwise
// short snippets that don't literally contain "vue" get rejected even
// though the source guarantees Vue (e.g. jobicy tag=vue, duunitori
// search=vue).
//
// NOTE: vuejobs.com was *removed* from this list (Apr 2026). Their /feed
// is a generic board feed that also lists Python/Django, Java, .NET,
// Angular and QA roles — trusting it was letting obvious non-Vue jobs
// through Stage 1. F1 will now run on vuejobs entries like any other
// source, which is fine because real Vue posts there always mention
// "Vue" in title or description.
const VUE_TRUSTED_SOURCES = new Set(['jobicy', 'duunitori']);

// Monday run uses a wider window to bridge the weekend gap.
const IS_MONDAY = new Date().getUTCDay() === 1;
const MAX_AGE_MS = (IS_MONDAY ? 168 : 96) * 60 * 60 * 1000;
const DATE_POSTED = IS_MONDAY ? 'week' : '3days';

// --- Fetchers ----------------------------------------------------------------

/**
 * InfoJobs — dominant Spanish job board. Public API with Basic Auth.
 * Uses the list endpoint (/api/1/offer) with keyword search.
 * `requirementMin` (2500 chars) is used as description since the list
 * endpoint doesn't return the full `description` field.
 *
 * Env: INFOJOBS_CLIENT_ID + INFOJOBS_CLIENT_SECRET
 */
async function fetchInfoJobs() {
  const clientId = process.env.INFOJOBS_CLIENT_ID;
  const clientSecret = process.env.INFOJOBS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn('[infojobs] INFOJOBS_CLIENT_ID or INFOJOBS_CLIENT_SECRET missing — skipping');
    return [];
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };

  // Build publishedMin for freshness (same window as JSearch)
  const publishedMin = new Date(Date.now() - MAX_AGE_MS).toISOString();

  // Search queries — keyword variations to maximize coverage
  const queries = ['vue', 'vuejs', 'vue.js'];
  const allJobs = [];

  for (const q of queries) {
    try {
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= 5) {
        const params = new URLSearchParams({
          q,
          country: 'espana',
          maxResults: '50',
          page: String(page),
          order: 'updated-desc',
          publishedMin,
        });
        const url = `https://api.infojobs.net/api/1/offer?${params}`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          console.warn(`[infojobs] q="${q}" page=${page} → ${res.status}`);
          break;
        }
        const json = await res.json();
        totalPages = json.totalPages ?? 1;
        const offers = json.offers ?? [];
        for (const o of offers) {
          const city = o.city ?? '';
          const province = o.province?.value ?? '';
          const location = [city, province].filter(Boolean).join(', ') || 'Spain';
          const desc = o.requirementMin ?? '';
          const title = o.title ?? '';

          allJobs.push({
            source: 'infojobs',
            title,
            company: o.author?.name ?? '',
            companyLogo: undefined,
            location,
            remotePolicy: /remoto|teletrabajo|remote/i.test(`${title} ${desc} ${location}`)
              ? 'remote'
              : 'uncertain',
            isRemoteStructured: false,
            postedAt: o.published ?? new Date().toISOString(),
            salaryMin: undefined,
            salaryMax: undefined,
            applyUrl: o.link ?? '',
            rawDescription: `${title}\n\n${desc}\n\nLocation: ${location}`,
          });
        }
        page++;
      }
    } catch (err) {
      console.warn(`[infojobs] q="${q}" → ${err.message}`);
    }
  }

  // Dedupe within InfoJobs results (same job may appear for multiple query keywords)
  const seen = new Set();
  return allJobs.filter((j) => {
    const key = `${j.company}::${j.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Adzuna — multi-country job search API. Free tier, query-param auth.
 * Searches Spain (es) by default with category=it-jobs.
 * Note: `description` is truncated to ~500 chars by the API.
 *
 * Env: ADZUNA_APP_ID + ADZUNA_APP_KEY
 */
async function fetchAdzuna() {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    console.warn('[adzuna] ADZUNA_APP_ID or ADZUNA_APP_KEY missing — skipping');
    return [];
  }

  const maxDaysOld = IS_MONDAY ? 7 : 4;
  const queries = ['vue developer', 'vue.js frontend', 'vuejs'];
  const allJobs = [];

  for (const q of queries) {
    try {
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= 5) {
        const params = new URLSearchParams({
          app_id: appId,
          app_key: appKey,
          results_per_page: '50',
          what: q,
          category: 'it-jobs',
          max_days_old: String(maxDaysOld),
          sort_by: 'date',
        });
        const url = `https://api.adzuna.com/v1/api/jobs/es/search/${page}?${params}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[adzuna] q="${q}" page=${page} → ${res.status}`);
          break;
        }
        const json = await res.json();
        const count = json.count ?? 0;
        totalPages = Math.ceil(count / 50);
        const results = json.results ?? [];
        for (const r of results) {
          const title = (r.title ?? '').replace(/<\/?strong>/gi, '');
          const desc = (r.description ?? '').replace(/<\/?strong>/gi, '');
          const location = r.location?.display_name ?? 'Spain';
          const company = r.company?.display_name ?? '';

          allJobs.push({
            source: 'adzuna',
            title,
            company,
            companyLogo: undefined,
            location,
            remotePolicy: /remote|remoto|teletrabajo/i.test(`${title} ${desc} ${location}`)
              ? 'remote'
              : 'uncertain',
            isRemoteStructured: false,
            postedAt: r.created ?? new Date().toISOString(),
            salaryMin: r.salary_is_predicted === '1' ? undefined : r.salary_min,
            salaryMax: r.salary_is_predicted === '1' ? undefined : r.salary_max,
            applyUrl: r.redirect_url ?? '',
            rawDescription: `${title}\n\n${desc}\n\nLocation: ${location}`,
          });
        }
        page++;
      }
    } catch (err) {
      console.warn(`[adzuna] q="${q}" → ${err.message}`);
    }
  }

  // Dedupe within Adzuna results
  const seen = new Set();
  return allJobs.filter((j) => {
    const key = `${j.company}::${j.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
    return (json.data ?? []).map((j) => {
      // city/country in the JSearch payload are unreliable (Indeed often
      // omits them on aggregator-reposted listings). Fall back to the
      // country code we *queried with* so a job pulled from country=es
      // at minimum surfaces as "Remote · ES" in the UI.
      const structuredLoc = [j.job_city, j.job_country].filter(Boolean).join(', ');
      const queryHint = country ? country.toUpperCase() : '';
      const location = structuredLoc || (queryHint ? `Remote · ${queryHint}` : 'Remote');
      return {
        source: 'jsearch',
        sourceCountry: country ?? null, // tracked for dedupe + UI hints
        title: j.job_title ?? '',
        company: j.employer_name ?? '',
        companyLogo: j.employer_logo ?? undefined,
        location,
        remotePolicy: j.job_is_remote ? 'remote' : 'uncertain',
        isRemoteStructured: j.job_is_remote === true,
        postedAt: j.job_posted_at_datetime_utc ?? new Date().toISOString(),
        salaryMin: j.job_min_salary ?? undefined,
        salaryMax: j.job_max_salary ?? undefined,
        applyUrl: j.job_apply_link ?? '',
        rawDescription: j.job_description ?? '',
      };
    });
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

async function fetchVueJobs() {
  // vuejobs.com is the official Vue community job board. Single RSS
  // endpoint, ~90 items at a time, every posting is Vue by definition
  // (no client-side keyword filter needed). Description body has a
  // structured "Employer:" + "Location:" prefix we can pull out.
  try {
    const res = await fetch('https://vuejobs.com/feed', {
      headers: {
        'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)',
      },
    });
    if (!res.ok) {
      console.warn(`[vuejobs] ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return items.map((item) => {
      const title = decodeHtmlEntities(extractTag(item, 'title'));
      const link = extractTag(item, 'link');
      const pubDate = extractTag(item, 'pubDate');
      const descRaw = decodeHtmlEntities(extractTag(item, 'description'));

      // Parse the structured Employer/Location fields against the RAW HTML
      // (before stripHtml flattens everything). vuejobs always emits them
      // as the first two <p><strong>...</strong></p> paragraphs, and many
      // postings ALSO mention "Location:" inside the Highlights body — if
      // we parsed against the flat text we'd capture the wrong one.
      const employerMatch = descRaw.match(/<strong>\s*Employer:\s*<\/strong>\s*([^<\n]+)/i);
      const locationMatch = descRaw.match(/<strong>\s*Location:\s*<\/strong>\s*([^<\n]+)/i);
      const company = employerMatch ? employerMatch[1].trim() : 'Unknown';
      const location = locationMatch ? locationMatch[1].trim() : 'Remote';

      const descText = stripHtml(descRaw);

      return {
        source: 'vuejobs',
        sourceCountry: null,
        title,
        company,
        companyLogo: undefined,
        location,
        remotePolicy: 'remote', // vuejobs is a remote-first board
        isRemoteStructured: true,
        postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        salaryMin: undefined,
        salaryMax: undefined,
        applyUrl: link,
        rawDescription: descText,
      };
    });
  } catch (err) {
    console.warn(`[vuejobs] ${err.message}`);
    return [];
  }
}

async function fetchDuunitori() {
  // Duunitori is the largest Finnish job board. Their public JSON API
  // returns ~20 results per "vue" search; descriptions are short snippets
  // (the full JD lives on the slug page) and most are in Finnish, but
  // since the search ran server-side we trust the Vue tag and skip the
  // client-side keyword filter.
  try {
    const res = await fetch('https://duunitori.fi/api/v1/jobentries?search=vue', {
      headers: {
        'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)',
      },
    });
    if (!res.ok) {
      console.warn(`[duunitori] ${res.status}`);
      return [];
    }
    const json = await res.json();
    return (json.results ?? []).map((j) => {
      const city = j.municipality_name || '';
      const location = city ? `${city}, FI` : 'Remote · FI';
      const descWithMeta = `${j.descr ?? ''}\n\nLocation: ${location}`;
      return {
        source: 'duunitori',
        sourceCountry: 'fi',
        title: j.heading ?? '',
        company: j.company_name ?? 'Unknown',
        companyLogo: undefined,
        location,
        // Duunitori doesn't expose a structured remote flag and the
        // Finnish snippet rarely contains "etätyö", so the F2 keyword
        // check would nuke them all. Trust the source and let Claude
        // judge remote/onsite from the JD body — the budget cost is
        // ~20 extra Haiku scoring calls per run, negligible.
        remotePolicy: 'remote',
        isRemoteStructured: true,
        postedAt: j.date_posted ?? new Date().toISOString(),
        salaryMin: undefined,
        salaryMax: undefined,
        applyUrl: j.slug ? `https://duunitori.fi/tyopaikat/${j.slug}` : '',
        rawDescription: descWithMeta,
      };
    });
  } catch (err) {
    console.warn(`[duunitori] ${err.message}`);
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

// --- Companies watchlist (ATS adapters) --------------------------------------

const FE_TITLE_RE =
  /frontend|front[- ]?end|ui (engineer|developer)|web (developer|engineer)|vue|nuxt|javascript|typescript|full[- ]?stack/i;

function atsGreenhouse(slug) {
  return async (companyName) => {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'vuenture/1.0 (https://github.com/aljacket/vuenture)' },
    });
    if (!res.ok) return [];
    const { jobs = [] } = await res.json();
    return jobs.filter((j) => FE_TITLE_RE.test(j.title)).map((j) => ({
      source: 'watchlist',
      title: j.title ?? '',
      company: companyName,
      companyLogo: undefined,
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
    return jobs.filter((j) => FE_TITLE_RE.test(j.title)).map((j) => {
      const loc = j.location || '';
      const secondaryLocs = (j.secondaryLocations ?? []).map((s) => s.location).join(', ');
      const fullLoc = secondaryLocs ? `${loc} (+ ${secondaryLocs})` : loc;
      return {
        source: 'watchlist',
        title: j.title ?? '',
        company: companyName,
        companyLogo: undefined,
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
    return postings.filter((j) => FE_TITLE_RE.test(j.text)).map((j) => {
      const loc = j.categories?.location ?? '';
      return {
        source: 'watchlist',
        title: j.text ?? '',
        company: companyName,
        companyLogo: undefined,
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

const ATS_ADAPTERS = { greenhouse: atsGreenhouse, ashby: atsAshby, lever: atsLever };

async function fetchCompanies() {
  const results = [];
  for (const entry of COMPANIES_WATCHLIST) {
    const adapterFactory = ATS_ADAPTERS[entry.ats];
    if (!adapterFactory) {
      console.warn(`[watchlist] unknown ATS "${entry.ats}" for ${entry.name}`);
      continue;
    }
    try {
      const adapter = adapterFactory(entry.slug);
      const jobs = await adapter(entry.name);
      console.log(`  watchlist ${entry.name} (${entry.ats}/${entry.slug}) → ${jobs.length} FE roles`);
      results.push(...jobs);
    } catch (err) {
      console.warn(`[watchlist] ${entry.name} → ${err.message}`);
    }
  }
  return results;
}

// --- Stage 1: hard filters ---------------------------------------------------

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function passesHardFilters(raw) {
  const title = raw.title.toLowerCase();
  const desc = stripHtml(raw.rawDescription).toLowerCase();
  const haystack = `${title} ${desc}`;

  // F1: Vue stack — skip for sources whose feed/search is Vue-only by
  // construction (their server-side filter is more reliable than our
  // regex against a short snippet that may not literally contain "vue").
  if (!VUE_TRUSTED_SOURCES.has(raw.source)) {
    const hasVue = VUE_KEYWORDS.some((k) => haystack.includes(k));
    if (!hasVue) return { ok: false, reason: 'no-vue' };
  }

  // F2: location
  // Always reject if there's an explicit blocker, even when the structured
  // flag says remote — sometimes the platform says "remote" but the JD body
  // clarifies "US only".
  const blockedByString = LOCATION_BLOCKERS.some((k) => desc.includes(k));
  const blockedByPattern = LOCATION_BLOCKER_PATTERNS.some((re) => re.test(desc));
  if (blockedByString || blockedByPattern) return { ok: false, reason: 'blocked-location' };
  // Country-level blocker: match against the structured location field
  // ("City, CC" suffix). JSearch happily marks IT-located roles as
  // job_is_remote=true, so the desc-level check above doesn't catch them.
  const locRaw = (raw.location ?? '').trim();
  const blockedByCountry = LOCATION_COUNTRY_BLOCKERS.some((cc) =>
    new RegExp(`(?:,\\s*|·\\s*)${cc}\\b`, 'i').test(locRaw)
  );
  if (blockedByCountry) return { ok: false, reason: 'blocked-country' };
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
  if (JUNIOR_TITLE_PATTERNS.some((re) => re.test(raw.title))) {
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

/**
 * Merge two variants of the same job (same company + title, different
 * sources/queries). Keep the richest field value from each side so that
 * e.g. a Madrid-tagged variant wins its `location` field over a bland
 * "Remote" fallback, and a salary-tagged variant keeps its numbers.
 *
 * Ordering: `a` is the existing entry, `b` is the newcomer. Neither is
 * "preferred" — we just pick the better-quality value per field.
 */
function mergeRawJobs(a, b) {
  const pickRicher = (va, vb, fallback) => {
    const isWeak = (v) => !v || v === fallback;
    if (isWeak(va) && !isWeak(vb)) return vb;
    return va;
  };
  // Location quality ladder: empty/Remote < "Remote · XX" < "City, Country".
  // The richer variant (more specific) always wins.
  const locationQuality = (v) => {
    if (!v || v === 'Remote') return 0;
    if (/^Remote\s*·/.test(v)) return 1;
    return 2;
  };
  const pickRicherLocation = (va, vb) =>
    locationQuality(vb) > locationQuality(va) ? vb : va;
  // For postedAt, keep the more recent timestamp (better freshness signal).
  const pickNewer = (va, vb) => {
    const ta = new Date(va).getTime();
    const tb = new Date(vb).getTime();
    if (!Number.isFinite(ta)) return vb;
    if (!Number.isFinite(tb)) return va;
    return tb > ta ? vb : va;
  };
  // For the description, keep the longer one — usually the fuller variant.
  const pickLonger = (va, vb) => ((vb?.length ?? 0) > (va?.length ?? 0) ? vb : va);

  return {
    ...a,
    companyLogo: a.companyLogo ?? b.companyLogo,
    sourceCountry: a.sourceCountry ?? b.sourceCountry,
    location: pickRicherLocation(a.location, b.location),
    // If either source says the role is structurally remote, trust it.
    remotePolicy: a.remotePolicy === 'remote' || b.remotePolicy === 'remote' ? 'remote' : a.remotePolicy,
    isRemoteStructured: a.isRemoteStructured || b.isRemoteStructured,
    postedAt: pickNewer(a.postedAt, b.postedAt),
    salaryMin: a.salaryMin ?? b.salaryMin,
    salaryMax: a.salaryMax ?? b.salaryMax,
    applyUrl: a.applyUrl || b.applyUrl,
    rawDescription: pickLonger(a.rawDescription, b.rawDescription),
  };
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
  // Count expert skill matches
  const expertHits = ['vue', 'typescript', 'tailwind', 'capacitor', 'claude'].filter(s => desc.includes(s)).length;
  const strongHits = ['vitest', 'figma', 'pinia'].filter(s => desc.includes(s)).length;
  const stack = Math.min(100, expertHits * 10 + strongHits * 5 + (desc.includes('vue') ? 40 : 0));
  const overall = Math.min(100, stack);
  return {
    overall,
    stack_match: stack,
    location_ok: true,
    seniority_fit: 'senior',
    reason: 'Heuristic score (claude CLI unavailable). Regex-based skill match; not LLM-judged.',
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
  for (const { query, country } of JSEARCH_QUERIES) {
    const results = await fetchJSearch(query, country);
    console.log(`  jsearch [${country ?? 'global'}] "${query}" → ${results.length}`);
    rawAll.push(...results);
  }
  const vueJobsResults = await fetchVueJobs();
  console.log(`  vuejobs feed → ${vueJobsResults.length}`);
  rawAll.push(...vueJobsResults);
  const duunitoriResults = await fetchDuunitori();
  console.log(`  duunitori search=vue → ${duunitoriResults.length}`);
  rawAll.push(...duunitoriResults);
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
  const infojobsResults = await fetchInfoJobs();
  console.log(`  infojobs vue-search → ${infojobsResults.length}`);
  rawAll.push(...infojobsResults);
  const adzunaResults = await fetchAdzuna();
  console.log(`  adzuna es vue-search → ${adzunaResults.length}`);
  rawAll.push(...adzunaResults);
  const watchlistResults = await fetchCompanies();
  console.log(`  watchlist total → ${watchlistResults.length} FE roles`);
  rawAll.push(...watchlistResults);
  // Stage 1: hard filters
  const rejected = { 'no-vue': 0, 'blocked-location': 0, 'blocked-country': 0, 'no-remote-signal': 0, stale: 0, junior: 0 };
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

  // Stage 2: dedupe + merge. Same job can appear across multiple sources
  // or across multiple JSearch queries (global + country index) with
  // different completeness — e.g. the global query returns `city=null`
  // while the country=es query returns `city=Madrid, country=ES`. Naive
  // "first seen wins" dedup loses the richer variant, so we merge per
  // field keeping the best value from each source.
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
    path.join(ROOT, 'scripts', 'scoringPrompt.md'),
    'utf8'
  );
  const scoringInstructions = scoringTemplate.replace(
    '{{SKILLS_CONTEXT}}',
    buildSkillsContext(SKILLS)
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
