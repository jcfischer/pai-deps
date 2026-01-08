# Implementation Tasks: F-024 Auto-discovery of manifests

## Task 1: Create discovery library

Create `src/lib/discovery.ts` with:

1. Define `DiscoveryOptions` and `DiscoveredManifest` interfaces
2. Implement `discoverManifests()` function:
   - Accept array of root directories
   - Walk directories recursively using `readdir` with `withFileTypes`
   - Check each directory for `pai-manifest.yaml`
   - Skip default excluded directories (node_modules, .git, dist, etc.)
   - Support custom exclude patterns via minimatch
   - Respect max depth limit
   - Track visited directories (by realpath) to avoid symlink loops
3. Add gitignore support:
   - Load and parse `.gitignore` at each level
   - Accumulate patterns from parent directories
   - Use `ignore` npm package for matching

## Task 2: Implement discover command

Create `src/commands/discover.ts`:

1. Accept positional `roots` argument (default: `~/work`)
2. Options:
   - `--include` (repeatable) - additional root directories
   - `--exclude` (repeatable) - patterns to exclude
   - `--max-depth` - depth limit (default: 10)
   - `--no-gitignore` - disable gitignore support
   - `--json` - JSON output
3. Output format (human-readable):
   ```
   Found N pai-manifest.yaml files:
     path/to/manifest1.yaml (tool-name)
     path/to/manifest2.yaml (tool-name)
   ```
4. JSON output: array of `{ path, name }` objects

## Task 3: Implement sync command

Create `src/commands/sync.ts`:

1. Use `discoverManifests()` to find all manifests
2. For each discovered manifest:
   - Check if already registered (by path)
   - If not registered: call register logic
   - If registered: check if manifest changed (compare hash or content)
   - Track: new, updated, unchanged, error counts
3. Options:
   - Same discovery options as discover command
   - `--force` - re-register even if unchanged
   - `--dry-run` - show what would happen
   - `--json` - JSON output
4. Output format:
   ```
   Synced N manifests:
     - X new
     - Y updated
     - Z unchanged
   ```

## Task 4: Add tests

Create `tests/discovery.test.ts`:

1. Test directory walking with mock filesystem
2. Test gitignore pattern matching
3. Test exclude pattern handling
4. Test max depth limiting
5. Test symlink loop detection
6. Test handling of invalid manifests

Create `tests/discover-command.test.ts`:
1. Test CLI argument parsing
2. Test output formats
3. Test with real directory structure

Create `tests/sync-command.test.ts`:
1. Test new registration
2. Test update detection
3. Test idempotency (run twice, same result)
4. Test dry-run mode

## Task 5: Register in CLI and update exports

1. Add discover and sync commands to `src/index.ts`
2. Install `ignore` package: `bun add ignore`
3. Update type exports if needed

## Verification

```bash
# All tests pass
bun test

# Type check passes
bun run typecheck

# Manual testing
cd ~/work/pai-deps
bun run src/index.ts discover ~/work --dry-run
bun run src/index.ts sync ~/work --dry-run
```
