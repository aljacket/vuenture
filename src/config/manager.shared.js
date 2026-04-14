/**
 * Shared config for Séverine Marchal's manager job search.
 *
 * Mirrors the structure of profile.shared.js but tailored for
 * Product/Project/Operations Manager roles in tech.
 */

/**
 * Skills matrix — Séverine's proficiency levels.
 * The scoring prompt reads this at runtime.
 */
export const MANAGER_SKILLS = {
  // Product & Project Management
  product_operations: 'expert',
  project_management: 'expert',
  agile_scrum: 'expert',
  jira: 'expert',
  confluence: 'expert',
  roadmap_planning: 'expert',
  prd_writing: 'expert',
  cross_functional_coordination: 'expert',
  stakeholder_management: 'expert',
  enterprise_delivery: 'expert',
  workflow_design: 'expert',

  // AI & Automation
  claude_code: 'expert',
  mcp_servers: 'expert',
  prompt_engineering: 'strong',
  cursor: 'strong',
  zapier: 'strong',

  // Technical (can bridge with engineering teams)
  vue_js: 'basic',
  react: 'basic',
  javascript: 'basic',
  html_css: 'basic',
  api_integration: 'basic',
  figma: 'strong',
  git: 'basic',
  supabase: 'basic',

  // Business
  b2b_saas: 'expert',
  client_onboarding: 'expert',
  budget_management: 'strong',
  contracts: 'strong',
  compliance_eu_fr: 'strong',
};

/**
 * Title regex — matches product/project/program/operations manager roles.
 * Intentionally broad to catch variants.
 */
export const MANAGER_TITLE_RE_SOURCE =
  'product\\s*(operations?\\s*)?manager|project\\s*manager|program\\s*manager|technical\\s*program\\s*manager|\\btpm\\b|delivery\\s*manager|operations\\s*manager|head\\s*of\\s*(product|operations|delivery|project)|chief\\s*of\\s*staff|scrum\\s*master';

/** F2 — explicit geographic / work-mode exclusions.
 *  Séverine is Valencia-based and wants FULL-REMOTE only (no hybrid, no on-site). */
export const MANAGER_LOCATION_BLOCKERS = [
  'us only',
  'usa only',
  'u.s. only',
  'us citizens only',
  'uk only',
  'canada only',
  'latam only',
  'apac only',
  'must relocate',
  'on-site only',
  'onsite only',
  'on site only',
  'no remote',
];

/** F2 — positive signals that confirm the role is FULL-REMOTE and accepts Spain.
 *  Intentionally narrow: no bare city/country names (they match hybrid roles too). */
export const MANAGER_LOCATION_ACCEPTORS = [
  'fully remote',
  'full remote',
  'full-remote',
  'remote-first',
  'remote first',
  '100% remote',
  'fully-remote',
  'remote from spain',
  'remote in spain',
  'remote (spain)',
  'remote, spain',
  'remote - europe',
  'remote (europe)',
  'remote in europe',
  'remote from europe',
  'remote - emea',
  'remote (emea)',
  'remote in emea',
  'remote, emea',
  'remote - eu',
  'remote in eu',
  'remote (eu)',
  'worldwide',
  'work from anywhere',
  'work-from-anywhere',
  'anywhere in europe',
  'anywhere in the eu',
  'anywhere in emea',
  'teletrabajo',
  'télétravail',
];

/** Tags to surface on manager job cards. */
export const MANAGER_TAG_KEYWORDS = [
  'Jira',
  'Confluence',
  'Agile',
  'Scrum',
  'Roadmap',
  'B2B',
  'SaaS',
  'Product Ops',
  'Claude',
  'AI',
  'Zapier',
  'Figma',
  'Stakeholder',
  'OKR',
  'Sprint',
  'Kanban',
];