# F-022: Documentation Updates

## README.md

Added two new commands to the Commands table:
- `ci check` - Run comprehensive verification checks for CI
- `ci affected` - Find tools affected by git changes

Updated Roadmap section:
- Marked "CI integration" as complete
- Marked "Chain reliability calculation" as complete (was already implemented)

## CLAUDE.md

No changes needed - the existing conventions and patterns apply to the new CI commands.

## New Files Created

### src/lib/ci/
- `git.ts` - Git operations (getChangedFiles, getStagedFiles, etc.)
- `mapper.ts` - File-to-tool mapping utilities
- `checker.ts` - Check aggregator for CI verification
- `index.ts` - Barrel export

### src/commands/ci.ts
CI subcommand with:
- `ci check` - Run drift, verify, and dependency checks
- `ci affected` - Find tools affected by git changes

## Command Reference

### pai-deps ci check

```bash
# Run all checks
pai-deps ci check

# Quick mode (skip slow checks)
pai-deps ci check --quick

# Only check staged files
pai-deps ci check --staged

# JSON output
pai-deps ci check --json
```

Exit codes:
- 0: All checks pass
- 1: One or more checks failed
- 2: Configuration or runtime error

### pai-deps ci affected

```bash
# Find affected tools compared to main
pai-deps ci affected

# Compare against different branch
pai-deps ci affected --base develop

# Only direct dependents
pai-deps ci affected --direct

# List format (one tool per line)
pai-deps ci affected --list

# JSON output
pai-deps ci affected --json
```
