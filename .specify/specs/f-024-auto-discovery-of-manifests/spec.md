# Feature Specification: F-024 Auto-discovery of manifests

## Problem Statement

Currently, users must manually register each tool with `pai-deps register <path>`. With 40+ tools across multiple directories (`~/work/`, `~/.claude/skills/`), this is tedious and error-prone. Users need an automated way to discover and register all PAI tools that have `pai-manifest.yaml` files.

## Users & Stakeholders

**Primary User:** PAI developer/maintainer (Jens-Christian)
**Technical Level:** Advanced - comfortable with CLI and filesystem operations

## Current State

- `register` command exists but requires explicit path to each manifest
- No way to scan directories recursively
- No way to register multiple manifests at once
- No awareness of gitignore patterns

## Requirements

### Functional

1. **discover command**: Recursively find all `pai-manifest.yaml` files under a root directory
   - Default root: `~/work/`
   - Support `--include` patterns for additional roots (e.g., `~/.claude/skills/`)
   - Support `--exclude` patterns to skip directories
   - Respect `.gitignore` patterns (skip node_modules, .git, etc.)
   - `--dry-run` option to show what would be found without registering

2. **sync command**: Register all discovered manifests in one command
   - Uses discover logic internally
   - Skips already-registered manifests (by path)
   - Reports new, updated, and skipped counts
   - `--force` to re-register even if already registered

### Non-Functional

- Discovery should complete in < 5 seconds for typical PAI layout
- Memory efficient - don't load all file contents into memory

## User Experience

### Discovery Flow
```bash
# Find all manifests (dry run)
pai-deps discover --dry-run
# Output:
# Found 42 pai-manifest.yaml files:
#   ~/work/email/pai-manifest.yaml
#   ~/work/supertag-cli/pai-manifest.yaml
#   ~/.claude/skills/SpecFlow/pai-manifest.yaml
#   ...

# Register all found manifests
pai-deps sync
# Output:
# Synced 42 manifests:
#   - 38 new
#   - 2 updated
#   - 2 skipped (unchanged)
```

### Error Handling
- Invalid YAML files: Skip with warning, continue processing
- Permission errors: Skip with warning, continue processing
- No manifests found: Show helpful message about expected locations

## Edge Cases & Error Handling

1. **Empty root directory**: Return empty list, no error
2. **Root doesn't exist**: Error with helpful message
3. **Symlink loops**: Avoid infinite recursion (track visited inodes)
4. **Very deep nesting**: Reasonable depth limit (default: 10 levels)
5. **Large directories**: Skip directories with 1000+ entries (likely node_modules missed)

## Success Criteria

1. Can discover all PAI manifests in < 5 seconds
2. Correctly skips node_modules, .git, and other ignored directories
3. `sync` command is idempotent - running twice produces same result
4. `--dry-run` shows accurate preview without side effects

## Scope & Future

### In Scope
- discover command with include/exclude patterns
- sync command to register all discovered manifests
- Gitignore-aware directory traversal
- Dry run mode

### Explicitly Out of Scope
- Watching for new manifests (future feature)
- Auto-generating missing manifests (covered by F-025)
- MCP integration
