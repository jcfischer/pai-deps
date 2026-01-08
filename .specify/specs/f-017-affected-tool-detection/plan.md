# F-017: Affected Tool Detection - Technical Plan

## Overview

The `affected` command is semantically similar to `rdeps --transitive` but with a focus on CI/CD use cases. It answers "what tools need retesting if this tool changes?" with cleaner defaults.

## Architecture

### Reuse

- Reuse `getTransitiveDependentsWithDepth()` from rdeps.ts or refactor to shared module
- Follow same command pattern as deps.ts, rdeps.ts

### New Command

```typescript
// src/commands/affected.ts
pai-deps affected <tool>     // All transitively affected (default)
pai-deps affected <tool> --direct  // Only direct dependents
pai-deps affected <tool> --json    // JSON output for CI
```

## Implementation Approach

1. Create `src/commands/affected.ts` following rdeps.ts pattern
2. Default to transitive behavior (opposite of rdeps which defaults to direct)
3. Add `--direct` flag for only immediate dependents
4. Register in cli.ts

## Key Differences from rdeps

| Aspect | rdeps | affected |
|--------|-------|----------|
| Default | Direct only | Transitive |
| Semantic | "What depends on me?" | "What breaks if I change?" |
| Flag | `--transitive` to expand | `--direct` to restrict |

## Testing

1. Empty graph - returns empty
2. Single tool - returns empty (no dependents)
3. Chain A→B→C - `affected A` returns [B, C]
4. Diamond pattern - correct depth calculation
5. Direct flag - only returns direct dependents
6. Unknown tool - error with exit code 1
