# Technical Plan: F-009 Reverse Dependency Queries (rdeps)

## Architecture

### Files to Modify/Create

```
src/
├── commands/
│   └── rdeps.ts          # NEW: rdeps command
├── lib/
│   └── graph/
│       └── algorithms.ts  # Add reverse traversal
└── index.ts              # Register rdeps command
```

## Implementation Approach

### 1. Reverse Adjacency List

The graph already stores forward edges (consumer → provider). For rdeps, we need reverse lookup (provider → consumers).

Option A: Build reverse adjacency on query (simple, O(E) per query)
Option B: Maintain reverse adjacency in graph loader (O(1) lookup, more memory)

**Decision:** Option A for simplicity - graph is small enough that O(E) is fine.

### 2. Algorithm

```typescript
function getReverseDependencies(
  graph: DependencyGraph,
  toolId: string,
  options: { transitive?: boolean; maxDepth?: number }
): RdepResult[] {
  // BFS from target, following reverse edges
  // Track depth for each discovered node
  // Return sorted by depth, then name
}
```

### 3. Command Structure

```bash
pai-deps rdeps <tool>
  -t, --transitive    Include transitive dependents
  -d, --depth <n>     Maximum depth (requires --transitive)
```

Mirror the `deps` command interface for consistency.

## Testing Strategy

1. Tool with no dependents
2. Tool with direct dependents only
3. Tool with transitive dependents (depth 2+)
4. Circular dependency handling
5. Non-existent tool error

## Reuse from deps command

- Table formatting
- JSON output structure
- Error handling patterns
- Global options integration
