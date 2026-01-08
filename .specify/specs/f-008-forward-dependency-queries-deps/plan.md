# Technical Plan: F-008 - Forward Dependency Queries (deps)

**Feature ID:** F-008
**Phase:** 3 (Query Commands)
**Estimated Hours:** 2

---

## Approach

Create a new `deps` command that uses the existing `DependencyGraph` class to query forward dependencies. The command loads the graph from the database and uses `getDependencies()` for direct or `getTransitiveDependencies()` for transitive queries. Output is formatted as ASCII table or JSON.

---

## Technical Design

### Architecture

```
src/commands/
└── deps.ts          # deps command implementation

Uses:
├── src/lib/graph/   # DependencyGraph (F-007)
├── src/db/          # Database connection
└── src/lib/output   # Output formatting utilities
```

### Command Flow

```
1. Parse arguments (tool ID, --transitive, --json)
2. Initialize database connection
3. Load DependencyGraph from database
4. Check if tool exists (error if not)
5. Query dependencies:
   - Direct: graph.getDependencies(toolId)
   - Transitive: graph.getTransitiveDependencies(toolId)
6. Format output (table or JSON)
7. Output result and exit
```

### Interface Design

```typescript
interface DepsOptions {
  transitive?: boolean;
  json?: boolean;
}

interface DepsResult {
  tool: string;
  transitive: boolean;
  dependencies: DependencyInfo[];
  count: number;
}

interface DependencyInfo {
  id: string;
  name: string;
  type: ToolType;
  reliability: number;
  depth?: number;  // Only for transitive queries
}
```

### Transitive Depth Calculation

For transitive queries, calculate depth using BFS:
```typescript
function getTransitiveWithDepth(
  graph: DependencyGraph,
  startId: string
): Map<string, number> {
  const depths = new Map<string, number>();
  const queue: [string, number][] = [];

  // Start with direct dependencies at depth 1
  for (const dep of graph.getDependencies(startId)) {
    queue.push([dep.id, 1]);
    depths.set(dep.id, 1);
  }

  // BFS to find all reachable with depths
  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;
    for (const next of graph.getDependencies(current)) {
      if (!depths.has(next.id)) {
        depths.set(next.id, depth + 1);
        queue.push([next.id, depth + 1]);
      }
    }
  }

  return depths;
}
```

---

## Failure Mode Analysis

| Failure Mode | Trigger | Detection | Recovery |
|--------------|---------|-----------|----------|
| Tool not found | Invalid ID | Graph.hasNode | Error message |
| Empty graph | No tools registered | nodeCount === 0 | Hint to register tools |
| Database error | Connection issue | Caught exception | Error message |

---

## Implementation Steps

1. Create `src/commands/deps.ts` with command structure
2. Implement table output formatting
3. Implement JSON output formatting
4. Implement transitive depth calculation
5. Register command in `src/index.ts`
6. Write comprehensive tests

---

## Doctorow Gate Checklist

- [ ] **Failure test:** Unknown tool returns clear error
- [ ] **Failure test:** Empty database works without crash
- [ ] **Assumption test:** Handles circular dependencies (via cycle detection in graph)
- [ ] **Rollback test:** Read-only operation, no state changes
- [ ] **Debt recorded:** Score 3 (query command)
