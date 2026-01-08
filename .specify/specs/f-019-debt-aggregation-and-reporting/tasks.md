# F-019: Debt Aggregation and Reporting - Tasks

## Implementation Tasks

- [x] Create `src/commands/debt.ts` with debt aggregation command
  - [x] Query tools from database
  - [x] Calculate total debt score
  - [x] Group by type with counts and averages
  - [x] Sort tools by debt (highest first)
  - [x] Support `--type` filter
  - [x] Support `--min` threshold filter
  - [x] Support JSON output
  - [x] Format ASCII tables for human output

- [x] Create `src/commands/report.ts` with report command
  - [x] Generate Markdown format
  - [x] System Overview section (tool count, deps, graph stats)
  - [x] Debt Analysis section (total, high debt tools, recommendations)
  - [x] Reliability Analysis section (compound reliability, at-risk tools)
  - [x] Cycle detection reporting
  - [x] Verification History section
  - [x] Support `--output` for file output
  - [x] Support JSON output

- [x] Register commands in `src/index.ts`
  - [x] Import debt and report commands
  - [x] Add command registrations

- [x] Verification
  - [x] Build passes (`bun run build`)
  - [x] Type check passes (`bun run typecheck`)
  - [x] Tests pass (`bun test`)
  - [x] Manual testing of both commands
