## ADDED Requirements

### Requirement: The dashboard SHALL persist a per-company interview history with optional rejection reason

The frontend SHALL persist an "interview history" map in `localStorage` under the key `vuenture:interviewHistory`. The value is a JSON object of shape `Record<string, { reason: string, markedAt: string }>`, where the key is the normalized company name (same `normalize` function used to build `Job.id`) and `markedAt` is an ISO-8601 timestamp.

#### Scenario: Marking a company for the first time

- **WHEN** the user clicks "Mark as interviewed" on a card for company "Reedsy" and submits reason "FE architecture depth"
- **THEN** `localStorage.getItem('vuenture:interviewHistory')` SHALL parse to an object containing the key `"reedsy"` with `reason === "FE architecture depth"` and a non-empty `markedAt`

#### Scenario: Unmarking a company

- **WHEN** the user clicks "Unmark" on a card for a company already in the store
- **THEN** the corresponding key SHALL be removed from the persisted object
- **AND** the card SHALL no longer display the "Already interviewed" badge on the next render

#### Scenario: Reason is optional

- **WHEN** the user marks a company and submits an empty reason string
- **THEN** the entry SHALL be persisted with `reason === ""` and the badge SHALL render without the reason fragment

### Requirement: Interview-history matching SHALL be normalized

Lookup, write, and unmark operations SHALL all run their company input through the shared `normalize` function before keying into the store. Display SHALL use the original (un-normalized) company name from the most recent matching `Job`.

#### Scenario: Mixed-case company variants

- **WHEN** the store contains the key `"too good to go"` and a job arrives with `company: "Too Good To Go"`
- **THEN** `isInterviewed(job.company)` SHALL return `true`

### Requirement: A new filter chip SHALL hide interviewed companies by default

`FilterBar.vue` SHALL expose a chip labelled `Hide interviewed` that toggles the new `FilterState.hideInterviewed` flag. The chip SHALL default to ON when the interview-history store is non-empty; OFF when the store is empty. The chip SHALL display the active count, e.g. `Hide interviewed (3)`.

#### Scenario: Filter is active and a card matches

- **WHEN** `FilterState.hideInterviewed === true` and the visible jobs list contains a Reedsy posting and the user has marked Reedsy
- **THEN** the Reedsy posting SHALL be excluded from the rendered list

#### Scenario: Filter is inactive

- **WHEN** the user clicks the `Hide interviewed` chip to deactivate it
- **THEN** previously hidden interviewed-company jobs SHALL re-appear, and SHALL render a non-dismissable banner reading `Already interviewed — {reason}` (or `Already interviewed` when reason is empty) above the title

### Requirement: Reedsy SHALL be seeded on first launch only

When the frontend boots and detects that the `localStorage` key `vuenture:interviewHistory` is *absent* (not merely empty `{}`), it SHALL write a single seed entry: `reedsy → { reason: "Frontend architecture depth (hexagonal/DDD) — under study", markedAt: <ISO now> }`. If the key exists with any value (including `{}`), no seeding SHALL occur.

#### Scenario: First boot

- **WHEN** the user opens the dashboard on a device where `localStorage.getItem('vuenture:interviewHistory')` returns `null`
- **THEN** after mount the store SHALL contain exactly one entry keyed `"reedsy"`

#### Scenario: User cleared the store

- **WHEN** `localStorage.getItem('vuenture:interviewHistory')` returns `"{}"`
- **THEN** no seeding SHALL occur and the store SHALL remain empty
