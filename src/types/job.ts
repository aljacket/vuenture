export interface JobScore {
  /** 0–100 overall fit for Alfonso's persona. */
  overall: number;
  /** 0–100 stack alignment (Vue-primary = 100). */
  stack_match: number;
  /** Is the employer OK with a Spain/CET-based full-remote worker? */
  location_ok: boolean;
  seniority_fit: 'junior' | 'mid' | 'senior' | 'lead+';
  /** 0–20 bonus when the role mentions AI tooling (Claude/Copilot/LLM/MCP/etc). */
  ai_bonus: number;
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
  source: 'jsearch' | 'arbeitnow';
  rawDescription: string;
  score: JobScore;
  bookmarked?: boolean;
}

export interface JobsFile {
  fetchedAt: string; // ISO
  jobs: Job[];
}

export interface FilterState {
  salaryFilter: boolean;
  typescriptRequired: boolean;
  aiToolingBonus: boolean;
  capacitorBonus: boolean;
}
