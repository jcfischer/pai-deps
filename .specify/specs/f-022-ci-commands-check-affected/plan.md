# F-022: Implementation Plan

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     pai-deps ci                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────┐     ┌─────────────────────────┐   │
│  │   ci check      │     │    ci affected          │   │
│  │                 │     │                         │   │
│  │ • drift         │     │ • git diff              │   │
│  │ • verify        │     │ • file→tool mapping     │   │
│  │ • dependencies  │     │ • transitive deps       │   │
│  └────────┬────────┘     └────────────┬────────────┘   │
│           │                           │                 │
│           └───────────┬───────────────┘                 │
│                       │                                 │
│              ┌────────▼────────┐                        │
│              │  lib/ci/        │                        │
│              │                 │                        │
│              │ • git.ts        │ ← git operations       │
│              │ • mapper.ts     │ ← file→tool mapping    │
│              │ • checker.ts    │ ← aggregated checks    │
│              └────────┬────────┘                        │
│                       │                                 │
│              ┌────────▼────────┐                        │
│              │  Existing libs  │                        │
│              │                 │                        │
│              │ • verifier.ts   │                        │
│              │ • hasher.ts     │                        │
│              │ • graph/        │                        │
│              └─────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

- **Runtime**: Bun (existing)
- **CLI**: Commander.js with subcommand pattern
- **Database**: SQLite/Drizzle (existing, no schema changes)
- **Git**: child_process.execSync (consistent with verify.ts)

## Data Model

No new database tables required. Commands operate on:
- `tools` table (existing) - for file→tool mapping via `path` column
- `dependencies` table (existing) - for transitive impact
- `contracts` table (existing) - for drift detection

## API Contracts

### `ci check` Command

```typescript
interface CiCheckOptions {
  quick?: boolean;     // Skip slow checks
  fix?: boolean;       // Auto-update drifted hashes
  staged?: boolean;    // Only staged files
}

interface CiCheckResult {
  success: boolean;
  checks: {
    drift: { passed: boolean; drifted: string[] };
    verify: { passed: boolean; failed: string[] };
    dependencies: { passed: boolean; issues: string[] };
  };
  summary: {
    passed: number;
    failed: number;
    skipped: number;
  };
}
```

### `ci affected` Command

```typescript
interface CiAffectedOptions {
  base?: string;       // Default: 'main'
  direct?: boolean;    // No transitive
  list?: boolean;      // Names only output
}

interface CiAffectedResult {
  success: boolean;
  base: string;
  changed: Array<{ tool: string; files: number }>;
  affected: Array<{ tool: string; via: string[]; depth: number }>;
  summary: {
    changedCount: number;
    affectedCount: number;
    totalCount: number;
  };
}
```

## File Structure

```
src/
├── commands/
│   └── ci.ts              # ci subcommand with check/affected
├── lib/
│   └── ci/
│       ├── index.ts       # Exports
│       ├── git.ts         # Git operations (diff, staged)
│       ├── mapper.ts      # File path → tool mapping
│       └── checker.ts     # Aggregated check runner
tests/
└── ci.test.ts             # Tests for CI commands
```

## Implementation Phases

### Phase 1: Git utilities (lib/ci/git.ts)
- `getChangedFiles(base: string): string[]` - git diff --name-only
- `getStagedFiles(): string[]` - git diff --cached --name-only
- `getDefaultBranch(): string` - detect main/master

### Phase 2: File-to-tool mapper (lib/ci/mapper.ts)
- `mapFilesToTools(files: string[]): Map<string, string[]>`
- Walk up from file to find pai-manifest.yaml
- Cache manifest locations for efficiency

### Phase 3: Check aggregator (lib/ci/checker.ts)
- Orchestrate drift, verify, and dependency checks
- Support quick mode (skip MCP, timeouts)
- Support staged-only filtering

### Phase 4: ci check command
- Wire up checker with CLI options
- Handle exit codes (0=pass, 1=fail, 2=error)
- JSON output support

### Phase 5: ci affected command
- Use git.ts + mapper.ts + existing graph
- Deduplicate affected tools
- Format output (human/json/list)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Slow git operations | Use --name-only, limit file count |
| Deep directory trees | Cache manifest locations |
| Large dependency graphs | Existing graph code handles this |
| Concurrent git access | Commands are read-only |

## Performance Targets

- `ci check --quick`: < 5 seconds
- `ci check` (full): < 30 seconds
- `ci affected`: < 2 seconds

## Success Criteria

1. All acceptance criteria from spec.md pass
2. Tests achieve >90% coverage of new code
3. Commands integrate with existing --json/--quiet/--verbose flags
4. Exit codes are reliable for CI pipelines
