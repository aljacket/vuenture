/**
 * LinkedIn detail-page parser.
 *
 * Used by the enrichment step in `fetchJobs.mjs` to turn a LinkedIn guest
 * job-detail HTML page into a clean description body. Kept in a separate
 * module so the parsing logic can be exercised in isolation under vitest
 * without spinning up the whole fetch pipeline.
 *
 * LinkedIn frequently shuffles their selectors. The functions below try a
 * small ordered list of known wrappers and return the first non-empty match.
 */

const DESCRIPTION_SELECTORS = [
  // Order matters — first match wins. These are the wrappers LinkedIn
  // currently uses on the public guest detail page (no auth).
  /<section[^>]*class="[^"]*\bshow-more-less-html\b[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
  /<div[^>]*class="[^"]*\bshow-more-less-html__markup\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  /<div[^>]*class="[^"]*\bdescription__text\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
];

function stripHtml(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse the description body from a LinkedIn job-detail HTML page.
 * Returns the plain-text body, or an empty string if none of the known
 * selectors matched.
 */
export function parseLinkedInDetailPage(html) {
  if (typeof html !== 'string' || html.length === 0) return '';
  for (const re of DESCRIPTION_SELECTORS) {
    const m = html.match(re);
    if (m && m[1]) {
      const body = stripHtml(m[1]);
      if (body.length > 0) return body;
    }
  }
  return '';
}

/**
 * Detect the soft-gate page LinkedIn returns for guest traffic that has
 * tripped its anti-scraping heuristics. The signal is a tiny HTML body
 * (well under the size of any real job page) plus a sign-in cue.
 */
export function looksGated(html) {
  if (typeof html !== 'string') return false;
  if (html.length >= 500) return false;
  return /Sign in|<title>LinkedIn<\/title>/i.test(html);
}

/**
 * Best-effort salary extraction from a LinkedIn detail page. LinkedIn rarely
 * exposes salary on the guest page, but when it does it shows as either
 * "$80,000.00/yr - $120,000.00/yr" or a plain "Salary: €60K - €80K" snippet.
 * Returns `{ min, max }` in EUR-equivalent integers, or `undefined` when
 * neither bound parses.
 */
export function parseLinkedInSalary(html) {
  if (typeof html !== 'string' || html.length === 0) return undefined;

  // Pattern 1: structured "<span>$80,000.00/yr - $120,000.00/yr</span>"
  // Pattern 2: free-text "Salary: 60,000 - 80,000 EUR"
  // Pattern 3: shorthand "$80K - $120K/yr"
  // Both bounds may carry an independent 'K' suffix.
  const range = html.match(
    /([€$£])?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(K)?\s*(?:\/?\s*yr|\/?\s*year|EUR|USD|GBP|€|\$|£)?\s*[-–]\s*([€$£])?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(K)?\s*(?:\/?\s*yr|\/?\s*year|EUR|USD|GBP|€|\$|£)?/i
  );
  if (!range) return undefined;

  const parseNum = (raw, kFlag) => {
    if (!raw) return NaN;
    // Strip thousands separators ('.' in EU, ',' in US). Decimal cents are
    // dropped — we only care about the order of magnitude.
    const cleaned = raw.replace(/[.,]/g, '');
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return NaN;
    // If the raw number was followed by 'K', multiply by 1000.
    return kFlag ? n * 1000 : n;
  };

  // Independent K flags: range[3] for min, range[6] for max.
  // If only one side carries K but the other side parses to a small
  // number (<1000), the K likely applies to both (e.g. "$80 - $120K").
  let minK = !!range[3];
  let maxK = !!range[6];
  const rawMin = parseNum(range[2], false);
  const rawMax = parseNum(range[5], false);
  if ((minK || maxK) && rawMin > 0 && rawMin < 1000 && !minK) minK = true;
  if ((minK || maxK) && rawMax > 0 && rawMax < 1000 && !maxK) maxK = true;
  const min = parseNum(range[2], minK);
  const max = parseNum(range[5], maxK);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  if (min <= 0 || max <= 0) return undefined;
  if (min > max) return undefined;

  return { min: Math.round(min), max: Math.round(max) };
}
