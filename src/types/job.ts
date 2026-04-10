export interface JobScore {
  /** 0–100 overall fit for Alfonso's persona. */
  overall: number;
  /** 0–100 stack alignment (Vue-primary = 100). */
  stack_match: number;
  /** Is the employer OK with a Spain/CET-based full-remote worker? */
  location_ok: boolean;
  seniority_fit: 'junior' | 'mid' | 'senior' | 'lead+';
  /** 2-line human-readable explanation. */
  reason: string;
  /** Short red-flag phrases, shown as chips on the card. */
  red_flags: string[];
}

export interface Job {
  /** Hash of normalize(company) + normalize(title). */
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  remotePolicy: 'remote' | 'hybrid' | 'onsite' | 'uncertain';
  postedAt: string; // ISO string
  salaryMin?: number;
  salaryMax?: number;
  tags: string[];
  applyUrl: string;
  source: 'jsearch' | 'arbeitnow' | 'remoteok' | 'jobicy' | 'wwr' | 'vuejobs' | 'duunitori' | 'infojobs' | 'adzuna';
  rawDescription: string;
  score: JobScore;
  bookmarked?: boolean;
}

export interface JobsFile {
  fetchedAt: string; // ISO
  /** Primary list: jobs Claude judged location-compatible with Spain/CET. */
  jobs: Job[];
  /**
   * Safety net: jobs that passed the regex hard filters but were flagged by
   * Claude as location-incompatible (`location_ok === false`). Hidden by
   * default in the dashboard, revealable via toggle so nothing is silently
   * lost if Claude is too strict.
   */
  needsReview: Job[];
}

export interface FilterState {
  salaryFilter: boolean;
  typescriptRequired: boolean;
  aiToolingBonus: boolean;
  capacitorBonus: boolean;
  bookmarkedOnly: boolean;
}
