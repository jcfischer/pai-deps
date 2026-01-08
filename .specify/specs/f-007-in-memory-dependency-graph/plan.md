# Technical Plan: F-007 - In-Memory Dependency Graph

**Feature ID:** F-007
**Phase:** 2 (Dependency Graph)
**Estimated Hours:** 4

---

## Approach

Implement a graph class using adjacency list representation with TypeScript Maps and Sets. Load from database using Drizzle queries. Implement standard graph algorithms for traversal, cycle detection, and topological sort.

---

## Technical Design

### Architecture

```
src/lib/
└── graph/
    ├── index.ts       # DependencyGraph class export
    ├── types.ts       # ToolNode, DependencyEdge, GraphJSON
    ├── loader.ts      # Database loading logic
    └── algorithms.ts  # Cycle detection, topo sort, path finding
```

### Data Structures

```typescript
// Internal representation
class DependencyGraph {
  private nodes: Map<string, ToolNode>;
  private edges: Map<string, DependencyEdge>;  // key: "from:to"
  private forward: Map<string, Set<string>>;   // tool -> dependencies
  private reverse: Map<string, Set<string>>;   // tool -> dependents
  private loadedAt: Date;
}
```

### Loading from Database

```typescript
static async load(db: DbType): Promise<DependencyGraph> {
  const graph = new DependencyGraph();

  // Load all tools
  const allTools = await db.select().from(tools);
  for (const tool of allTools) {
    graph.nodes.set(tool.id, {
      id: tool.id,
      name: tool.name,
      type: tool.type as ToolType,
      version: tool.version ?? undefined,
      reliability: tool.reliability ?? 0.95,
      debtScore: tool.debtScore ?? 0,
      stub: tool.stub === 1,
    });
    graph.forward.set(tool.id, new Set());
    graph.reverse.set(tool.id, new Set());
  }

  // Load all dependencies
  const allDeps = await db.select().from(dependencies);
  for (const dep of allDeps) {
    const edge: DependencyEdge = {
      from: dep.consumerId,
      to: dep.providerId,
      type: dep.type as DependencyType,
      version: dep.versionConstraint ?? undefined,
      optional: dep.optional === 1,
    };

    graph.edges.set(`${dep.consumerId}:${dep.providerId}`, edge);
    graph.forward.get(dep.consumerId)?.add(dep.providerId);
    graph.reverse.get(dep.providerId)?.add(dep.consumerId);
  }

  graph.loadedAt = new Date();
  return graph;
}
```

### Algorithm Implementations

```typescript
// Cycle detection using DFS
findCycles(): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string) => {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of this.forward.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
      }
    }

    path.pop();
    recStack.delete(node);
  };

  for (const node of this.nodes.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

// Topological sort using Kahn's algorithm
topologicalSort(): string[] {
  const inDegree = new Map<string, number>();
  for (const node of this.nodes.keys()) {
    inDegree.set(node, 0);
  }

  for (const node of this.nodes.keys()) {
    for (const dep of this.forward.get(node) ?? []) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const queue = [...this.nodes.keys()].filter(n => inDegree.get(n) === 0);
  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const dep of this.forward.get(node) ?? []) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) - 1);
      if (inDegree.get(dep) === 0) {
        queue.push(dep);
      }
    }
  }

  return result;
}

// Path finding using BFS
findPath(from: string, to: string): string[] | null {
  if (!this.hasNode(from) || !this.hasNode(to)) return null;
  if (from === to) return [from];

  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue = [from];
  visited.add(from);

  while (queue.length > 0) {
    const node = queue.shift()!;

    for (const neighbor of this.forward.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, node);

        if (neighbor === to) {
          // Reconstruct path
          const path = [to];
          let current = to;
          while (current !== from) {
            current = parent.get(current)!;
            path.unshift(current);
          }
          return path;
        }

        queue.push(neighbor);
      }
    }
  }

  return null;
}
```

---

## Failure Mode Analysis

| Failure Mode | Trigger | Detection | Recovery |
|--------------|---------|-----------|----------|
| Database unavailable | Connection error | Load throws | Retry or error |
| Dangling reference | Tool deleted | Node not found | Filter nulls |
| Very large graph | 1000+ tools | Slow load | Pagination (future) |

---

## Implementation Steps

1. Create `src/lib/graph/types.ts` with interfaces
2. Create `src/lib/graph/loader.ts` with load function
3. Create `src/lib/graph/algorithms.ts` with graph algorithms
4. Create `src/lib/graph/index.ts` with DependencyGraph class
5. Create comprehensive tests
6. Export from `src/lib/index.ts`

---

## Doctorow Gate Checklist

- [ ] **Failure test:** Empty database produces empty graph
- [ ] **Failure test:** Missing node reference handled gracefully
- [ ] **Assumption test:** Handles 100+ tools performantly
- [ ] **Rollback test:** No external state, can recreate from DB
- [ ] **Debt recorded:** Score 4 (core data structure)
