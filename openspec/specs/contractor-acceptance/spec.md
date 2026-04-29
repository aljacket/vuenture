# contractor-acceptance Specification

## Purpose
TBD - created by archiving change improve-linkedin-and-track-rejected-companies. Update Purpose after archive.
## Requirements
### Requirement: Scoring prompt SHALL treat contractor / freelance / B2B as acceptable employment forms

The Stage 3 scoring instructions in `scripts/scoringPrompt.md` SHALL include a paragraph (under *Context* or a new *Employment forms* sub-section) stating that direct contractor, freelance, B2B, and self-employed engagements are acceptable for Alfonso, MUST NOT be added to `red_flags` solely on the basis of the employment form, and MUST NOT lower `overall` solely for being non-permanent.

#### Scenario: Direct freelance role

- **WHEN** Claude scores a job whose description says "we are looking for a Vue.js freelance contractor for a long-term engagement"
- **THEN** the returned `red_flags` array SHALL NOT contain a phrase referring to the contract / freelance employment form
- **AND** `overall` SHALL be derived from stack / location / seniority signals as if the role were permanent

### Requirement: Scoring prompt SHALL still flag agency-style staff augmentation

The same paragraph SHALL list explicit signals that DO warrant a red flag: "client-facing consultancy", "we'll place you with clients", "rotating client engagements", "body-shop", or descriptions where the hiring entity is clearly a staff-augmentation agency rather than a product company. These signals SHALL produce a red flag and a `stack_match` cap of 60.

#### Scenario: Agency staff augmentation

- **WHEN** Claude scores a job whose description says "join our talent network — we match consultants with our enterprise clients"
- **THEN** the returned `red_flags` SHALL contain a phrase like `"agency staff augmentation"` or equivalent
- **AND** `stack_match` SHALL be ≤ 60 even if the stack is a perfect match

#### Scenario: Permanent role at a product company

- **WHEN** Claude scores a permanent Vue.js role at an identified product company
- **THEN** the new contractor-acceptance language SHALL NOT alter the score relative to the previous prompt version (no behavioral change for non-contractor roles)

