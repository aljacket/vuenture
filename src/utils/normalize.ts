/**
 * Lowercase, strip diacritics, collapse non-alphanumerics to single spaces,
 * trim. Matches the implementation in `scripts/fetchJobs.mjs` so frontend
 * lookups against company-keyed stores agree with the IDs the fetch
 * pipeline produced.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
