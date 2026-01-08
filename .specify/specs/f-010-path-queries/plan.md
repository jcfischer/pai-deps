# Technical Plan: F-010 Path Queries

## Architecture

### Files to Create

```
src/
├── commands/
│   ├── path.ts           # NEW: path command (shortest path)
│   └── allpaths.ts       # NEW: allpaths command (all paths)
└── index.ts              # Register commands
```

## Implementation Approach

### 1. Reuse Existing Graph Methods

The DependencyGraph class already provides:
- `findPath(from, to)` - BFS shortest path, returns `string[] | null`
- `findAllPaths(from, to, maxPaths)` - DFS all paths, returns `string[][]`

Commands just need to:
1. Load graph from database
2. Validate tool IDs exist
3. Call appropriate method
4. Format output

### 2. Command Structure

```bash
# Shortest path
pai-deps path <from> <to>
  --json              JSON output

# All paths
pai-deps allpaths <from> <to>
  --limit <n>         Max paths to return (default: 10)
  --json              JSON output
```

### 3. Output Formatting

Human-readable uses arrow notation: `A → B → C`
- Include hop count
- For allpaths, show count and min/max lengths

## Testing Strategy

1. Path exists (direct)
2. Path exists (transitive)
3. No path exists
4. Same source and target
5. Tool not found
6. Multiple paths
7. JSON output format
