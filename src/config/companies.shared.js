/**
 * Companies watchlist — curated Vue shops with known ATS endpoints.
 *
 * Each entry maps to a public JSON API (Greenhouse, Ashby, Lever,
 * Workable, or Recruitee).
 * The fetch script iterates this list, hits the ATS adapter, and feeds
 * results into the normal Stage 1–3 pipeline.
 *
 * To add a company:
 *   1. Identify the ATS — check the careers page source or probe:
 *        curl -sI https://boards-api.greenhouse.io/v1/boards/SLUG/jobs
 *        curl -sI https://api.ashbyhq.com/posting-api/job-board/SLUG
 *        curl -sI https://api.lever.co/v0/postings/SLUG?mode=json
 *        curl -s -X POST https://apply.workable.com/api/v3/accounts/SLUG/jobs
 *        curl -sI https://SLUG.recruitee.com/api/offers/
 *   2. Add an entry with { name, ats, slug }.
 *   3. Run `npm run fetch-jobs` to verify.
 */

export const COMPANIES_WATCHLIST = [
  // ─── Greenhouse ────────────────────────────────────────────────
  { name: 'GitLab', ats: 'greenhouse', slug: 'gitlab' },
  { name: 'Storyblok', ats: 'greenhouse', slug: 'storyblok' },
  { name: 'Typeform', ats: 'greenhouse', slug: 'typeform' },
  { name: 'Too Good To Go', ats: 'greenhouse', slug: 'toogoodtogo' },
  { name: 'Netlify', ats: 'greenhouse', slug: 'netlify' },
  { name: 'Remote.com', ats: 'greenhouse', slug: 'remotecom' },
  { name: 'Mews', ats: 'greenhouse', slug: 'mewssystems' },
  { name: 'DataCamp', ats: 'greenhouse', slug: 'datacamp' },
  { name: 'Doctolib', ats: 'greenhouse', slug: 'doctolib' },
  { name: 'Shift Technology', ats: 'greenhouse', slug: 'shifttechnology' },
  { name: 'Vercel', ats: 'greenhouse', slug: 'vercel' },           // React-dominant; ecosystem signal only
  { name: 'GoDaddy', ats: 'greenhouse', slug: 'godaddy' },         // Mostly React; watch for Vue-specific roles

  // ─── Ashby ─────────────────────────────────────────────────────
  { name: 'n8n', ats: 'ashby', slug: 'n8n' },
  { name: 'Pleo', ats: 'ashby', slug: 'pleo' },
  { name: 'Back Market', ats: 'ashby', slug: 'backmarket' },
  { name: 'Alan', ats: 'ashby', slug: 'alan' },
  { name: 'Pennylane', ats: 'ashby', slug: 'pennylane' },
  { name: 'Voodoo', ats: 'ashby', slug: 'voodoo' },
  { name: 'Lunar', ats: 'ashby', slug: 'lunar' },

  // ─── Lever ─────────────────────────────────────────────────────
  { name: 'Hostinger', ats: 'lever', slug: 'hostinger' },
  { name: 'Push Security', ats: 'lever', slug: 'pushsecurity' },
  { name: 'Veepee', ats: 'lever', slug: 'veepee' },
  { name: 'Qonto', ats: 'lever', slug: 'qonto' },
  { name: 'Malt', ats: 'lever', slug: 'malt' },
  { name: 'Swile', ats: 'lever', slug: 'swile' },
  { name: 'Aircall', ats: 'lever', slug: 'aircall' },
  { name: 'Contentsquare', ats: 'lever', slug: 'contentsquare' },
  { name: 'Prismic', ats: 'lever', slug: 'prismic' },
  { name: 'Scaleway', ats: 'lever', slug: 'scaleway' },

  // ─── Recruitee ─────────────────────────────────────────────────
  { name: 'Livestorm', ats: 'recruitee', slug: 'livestorm' },

  // Workable entries removed — their v3 API is behind Cloudflare
  // (error 1015) and the v1 widget returns empty boards for most
  // companies. Notable Workable companies to revisit if an adapter
  // becomes viable: Ionic, Factorial HR, ManoMano, Criteo, OVHcloud.
];
