# Implementation Tasks: F-010 Path Queries

## Task 1: Create path command

Create `src/commands/path.ts`:

1. Command definition:
   - `path <from> <to>` - both required
   - `--json` for JSON output

2. Implementation:
   - Load graph from database
   - Validate both tools exist
   - Call `graph.findPath(from, to)`
   - Format and display result

3. Output formatting:
   - Arrow notation: `A → B → C`
   - Show length in hops
   - Exit code 1 if no path

## Task 2: Create allpaths command

Create `src/commands/allpaths.ts`:

1. Command definition:
   - `allpaths <from> <to>` - both required
   - `--limit <n>` - max paths (default: 10)
   - `--json` for JSON output

2. Implementation:
   - Load graph from database
   - Validate both tools exist
   - Call `graph.findAllPaths(from, to, limit)`
   - Format and display results

3. Output formatting:
   - Number each path
   - Show total count
   - Show min/max lengths

## Task 3: Register commands

Update `src/index.ts`:
1. Import pathCommand, allpathsCommand
2. Register with program

## Task 4: Add tests

Create `tests/path.test.ts`:

1. Test direct path (A → B)
2. Test transitive path (A → B → C)
3. Test no path exists
4. Test multiple paths
5. Test tool not found
6. Test JSON output

## Verification

```bash
bun test
bun run typecheck

# Manual testing
pai-deps path daily-briefing resona
pai-deps allpaths daily-briefing resona --limit 5
pai-deps path email email  # same tool
pai-deps path nonexistent resona  # should error
```
