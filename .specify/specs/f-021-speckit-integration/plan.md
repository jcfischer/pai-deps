# F-021: SpecKit Integration - Technical Plan

## Overview

Add a `speckit` command group with two subcommands: `context` and `failures`. Both reuse existing graph infrastructure.

## Architecture Decision

### Single Command File with Subcommands
Use Commander.js subcommand pattern:
```typescript
program
  .command('speckit')
  .description('SpecKit integration commands')
  .addCommand(contextCommand)
  .addCommand(failuresCommand);
```

Alternative considered: Two separate commands (`speckit-context`, `speckit-failures`). Rejected because grouping under `speckit` namespace is cleaner and matches the integration pattern.

## Data Sources

All data already exists - this is aggregation and formatting:

| Data | Source | Method |
|------|--------|--------|
| Upstream deps | DependencyGraph | `getTransitiveDependencies(toolId)` |
| Downstream consumers | DependencyGraph | `getTransitiveRdeps(toolId)` |
| Compound reliability | chain-reliability logic | `calculateChainReliability()` |
| Blast radius | blast-radius logic | `calculateBlastRadius()` |
| Cycles | DependencyGraph | `findCycles()` filtered for tool |
| Failure modes | Generated | Template per dependency type |

## Failure Mode Generation

Failure modes are generated from templates based on dependency type:

```typescript
const failureModeTemplates: Record<string, FailureModeTemplate> = {
  cli: {
    mode: '{name} CLI unavailable',
    detection: 'CLI returns non-zero exit code or timeout',
    recovery: 'Skip {name} data, continue with partial output',
  },
  mcp: {
    mode: '{name} MCP server unavailable',
    detection: 'MCP tool call returns error or connection refused',
    recovery: 'Fall back to CLI interface if available',
  },
  library: {
    mode: '{name} library throws exception',
    detection: 'Catch block triggered on import or function call',
    recovery: 'Log error, degrade gracefully',
  },
  database: {
    mode: '{name} database unavailable',
    detection: 'Connection timeout or query error',
    recovery: 'Use cached data if available, retry with backoff',
  },
};
```

## Severity Calculation

Severity is based on downstream impact:
- **critical**: >5 downstream tools affected
- **high**: 3-5 downstream tools affected
- **medium**: 1-2 downstream tools affected
- **low**: 0 downstream tools affected

## File Structure

```
src/commands/
  speckit.ts          # Main command group + subcommands (context, failures)
```

Single file is sufficient - commands are lightweight aggregation.

## Dependencies

Reuses existing:
- `DependencyGraph` from `src/lib/graph/index.ts`
- `getDb()` from `src/db/index.ts`
- Output helpers from `src/lib/output.ts`

No new dependencies required.

## Risk Assessment

**Very low risk** - Read-only aggregation of existing data with templated output generation. No schema changes.

## Testing Strategy

- Unit tests for failure mode template generation
- Unit tests for severity calculation
- Integration test with test database verifying JSON output structure
