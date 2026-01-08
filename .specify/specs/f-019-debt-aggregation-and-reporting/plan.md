# F-019: Debt Aggregation and Reporting - Technical Plan

## Overview

Implement two new commands (`debt` and `report`) to provide visibility into technical debt across the tool ecosystem.

## Approach

### 1. Debt Command (`pai-deps debt`)

**Data Sources:**
- Query `tools` table for all non-stub tools
- Use existing `debtScore` field from database schema
- Group and aggregate by `type` field

**Implementation:**
- Create `src/commands/debt.ts`
- Follow existing command patterns (chain-reliability.ts)
- Use `formatTable` helper for ASCII output
- Support `--type` filter and `--min` threshold
- Support `--json` output via global options

### 2. Report Command (`pai-deps report`)

**Data Sources:**
- Tools from database
- Dependencies from database
- DependencyGraph for graph analysis
- toolVerifications for history

**Implementation:**
- Create `src/commands/report.ts`
- Generate Markdown format output
- Include all sections from spec (overview, debt, reliability, verifications)
- Support `--output` for file output
- Support `--json` via global options

## Risk Assessment

Low risk - both commands are read-only aggregations of existing data.

## Testing Strategy

- Build verification (bun build passes)
- Type checking (tsc --noEmit passes)
- Manual testing of both commands
- Existing test suite continues to pass
