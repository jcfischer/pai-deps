# F-022: CI Commands (check, affected)

## Overview

Implement CI-focused commands for pai-deps that integrate with git workflows. These commands enable pre-commit verification and impact analysis based on git changes.

## Commands

### `pai-deps ci check`

Pre-commit verification command that runs comprehensive validation on tools in the current repository.

**Purpose**: Run in CI pipelines or as pre-commit hook to verify tool health before merging.

**Checks performed**:
1. Schema drift detection (any contracts with changed hashes)
2. CLI contract verification (commands exist and respond)
3. MCP tool verification (tools declared match server)
4. Dependency health (no circular dependencies, all deps exist)

**Options**:
- `--quick` - Skip slow checks (MCP verification, full CLI tests)
- `--fix` - Auto-update drifted schema hashes (for intentional changes)
- `--staged` - Only check tools with staged changes (for pre-commit)
- `--json` - JSON output for programmatic use

**Exit codes**:
- 0: All checks pass
- 1: One or more checks failed
- 2: Configuration or runtime error

### `pai-deps ci affected --base <branch>`

Find tools affected by changes since a base branch using git diff.

**Purpose**: Determine which downstream tools need retesting after changes.

**Behavior**:
1. Run `git diff --name-only <base>...HEAD` to get changed files
2. Map changed files to their containing tools (via pai-manifest.yaml location)
3. For each changed tool, compute transitive dependents
4. Report unique set of all affected tools

**Options**:
- `--base <branch>` - Compare against this branch (default: main)
- `--direct` - Only show directly dependent tools
- `--json` - JSON output for CI integration
- `--list` - Output tool names only (one per line, for scripting)

**Output (human)**:
```
Changed tools (from git diff):
  email (3 files changed)
  tana (1 file changed)

Affected downstream:
  daily-briefing (via email)
  meeting-intelligence (via email, tana)

Total: 4 tools need verification
```

**Output (JSON)**:
```json
{
  "success": true,
  "base": "main",
  "changed": [
    { "tool": "email", "files": 3 }
  ],
  "affected": [
    { "tool": "daily-briefing", "via": ["email"], "depth": 1 }
  ],
  "summary": {
    "changedCount": 1,
    "affectedCount": 1,
    "totalCount": 2
  }
}
```

## Implementation Notes

### File-to-tool mapping

Create utility to map file paths to their owning tool:
1. Walk up directory tree from changed file
2. Look for pai-manifest.yaml
3. Return tool ID from manifest, or null if not in a registered tool

### Git integration

Use `child_process.execSync` for git commands (consistent with existing `getGitCommit()` pattern in verify.ts).

### Command structure

Use Commander.js subcommand pattern:
```typescript
const ci = program.command('ci').description('CI integration commands');
ci.command('check')...
ci.command('affected')...
```

## Acceptance Criteria

- [ ] `pai-deps ci check` runs all verification checks and exits with appropriate code
- [ ] `pai-deps ci check --quick` completes in < 5 seconds for typical projects
- [ ] `pai-deps ci check --staged` only checks tools with git staged changes
- [ ] `pai-deps ci affected --base main` correctly identifies changed tools
- [ ] `pai-deps ci affected` shows transitive impact
- [ ] Both commands support `--json` output
- [ ] Exit codes are consistent and documented
- [ ] Tests cover main use cases

## Non-goals

- Git hook installation (F-023)
- GitHub Actions/CI config generation
- Caching of verification results across runs
