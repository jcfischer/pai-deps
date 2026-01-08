# F-020: Health Dashboard - Technical Plan

## Overview

Create a single `health` command that aggregates data from multiple sources to display a terminal-based health dashboard.

## Data Sources

All data already exists - this is purely aggregation and display:

| Metric | Source | Query |
|--------|--------|-------|
| Tool count | `tools` table | `SELECT COUNT(*) FROM tools WHERE stub = 0` |
| Dependency count | `dependencies` table | `SELECT COUNT(*) FROM dependencies` |
| Total debt | `tools` table | `SUM(debt_score)` |
| Avg reliability | `tools` table | `AVG(reliability)` |
| Verified count | `tools` table | `COUNT(*) WHERE last_verified IS NOT NULL` |
| Cycles | `DependencyGraph.findCycles()` | Already implemented |
| At-risk tools | `DependencyGraph` | Compound reliability < 0.8 |

## Architecture Decisions

### 1. Single Command File
- Create `src/commands/health.ts`
- Follow existing command patterns (debt.ts, chain-reliability.ts)
- No new lib modules needed - reuse existing

### 2. Box Drawing
- Use Unicode box-drawing characters (already used in table.ts)
- Create helper function for dashboard layout
- Consider terminal width (default 80 cols)

### 3. Status Determination
```typescript
type HealthStatus = 'OK' | 'WARNING' | 'CRITICAL';

// Logic:
// CRITICAL: cycles > 0 AND tools below threshold > 3
// WARNING: cycles > 0 OR any tool below threshold OR >50% unverified
// OK: everything else
```

### 4. Compact Mode
- Single line: `OK tools:34 deps:29 debt:5 rel:94.8% issues:2`
- Exit code 0 for OK, 1 for WARNING/CRITICAL (for scripting)

### 5. Color Support
- Green for OK, Yellow for WARNING, Red for CRITICAL
- Use ANSI escape codes
- `--no-color` disables (respects NO_COLOR env var too)

## Risk Assessment

**Low risk** - Read-only aggregation of existing data, no schema changes.

## Dependencies

- Existing: `DependencyGraph`, `getDb()`, `formatTable()`, output helpers
- No new dependencies required

## Testing Strategy

- Unit tests for status determination logic
- Unit tests for compact output format
- Integration test with test database
- Manual visual verification of ASCII layout
