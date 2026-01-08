# Feature Specification: F-010 Path Queries

## Problem Statement

Users need to understand how two tools are connected in the dependency graph. Questions like:
- "How does daily-briefing depend on resona?" (what's the chain?)
- "Are there multiple paths between these tools?"
- "What's the shortest dependency chain?"

## Users & Stakeholders

**Primary User:** PAI developer analyzing dependencies
**Use Case:** Understanding transitive relationships, debugging dependency issues

## Current State

- DependencyGraph already has `findPath()` and `findAllPaths()` methods
- No CLI command exposes these capabilities
- Users can only see direct dependencies via `deps` command

## Requirements

### Functional

1. **path command**: Find shortest path between two tools
   - `pai-deps path <from> <to>` - show shortest dependency path
   - Shows chain: A → B → C → D
   - Exit code 0 if path exists, 1 if no path

2. **allpaths command**: Find all paths between two tools
   - `pai-deps allpaths <from> <to>` - show all dependency paths
   - `--limit N` - max number of paths (default: 10)
   - Useful for understanding multiple connection routes

3. **Output format** (human-readable):
   ```
   Path from daily-briefing to resona:

   daily-briefing → email → resona

   Length: 2 hops
   ```

4. **allpaths output**:
   ```
   Paths from daily-briefing to resona (3 found):

   1. daily-briefing → email → resona
   2. daily-briefing → calendar → email → resona
   3. daily-briefing → meeting-intelligence → email → resona

   Shortest: 2 hops | Longest: 3 hops
   ```

5. **JSON output**:
   ```json
   {
     "from": "daily-briefing",
     "to": "resona",
     "path": ["daily-briefing", "email", "resona"],
     "length": 2
   }
   ```

### Non-Functional

- Path finding should complete in < 100ms for typical graph
- Reuse existing graph algorithms (BFS for shortest, DFS for all)

## Edge Cases & Error Handling

1. **No path exists**: "No dependency path from A to B"
2. **Same tool**: "Source and target are the same tool"
3. **Tool not found**: Error with helpful message
4. **Circular path**: Handle gracefully (already in algorithms)

## Success Criteria

1. `pai-deps path A B` shows shortest dependency chain
2. `pai-deps allpaths A B` shows all paths with limit
3. Both commands support `--json` output
4. Proper exit codes for scripting
