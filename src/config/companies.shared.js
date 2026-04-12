/**
 * Companies watchlist — curated Vue shops with known ATS endpoints.
 *
 * Each entry maps to a public JSON API (Greenhouse, Ashby, or Lever).
 * The fetch script iterates this list, hits the ATS adapter, and feeds
 * results into the normal Stage 1–3 pipeline.
 *
 * To add a company:
 *   1. Identify the ATS — check the careers page source or probe:
 *        curl -sI https://boards-api.greenhouse.io/v1/boards/SLUG/jobs
 *        curl -sI https://api.ashbyhq.com/posting-api/job-board/SLUG
 *        curl -sI https://api.lever.co/v0/postings/SLUG?mode=json
 *   2. Add an entry with { name, ats, slug }.
 *   3. Run `npm run fetch-jobs` to verify.
 */

export const COMPANIES_WATCHLIST = [
  // --- Greenhouse ---
  { name: 'GitLab', ats: 'greenhouse', slug: 'gitlab' },
  { name: 'Storyblok', ats: 'greenhouse', slug: 'storyblok' },
  { name: 'Typeform', ats: 'greenhouse', slug: 'typeform' },
  // --- Ashby ---
  { name: 'n8n', ats: 'ashby', slug: 'n8n' },
  { name: 'Pleo', ats: 'ashby', slug: 'pleo' },
  { name: 'Back Market', ats: 'ashby', slug: 'backmarket' },
  // --- Lever ---
  { name: 'Hostinger', ats: 'lever', slug: 'hostinger' },
];
