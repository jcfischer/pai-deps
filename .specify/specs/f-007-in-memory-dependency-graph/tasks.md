# Implementation Tasks: F-007 - In-Memory Dependency Graph

**Feature ID:** F-007
**Total Estimated Time:** 4 hours
**Parallelizable:** Tasks 1-2 parallel, then 3-6 sequential

---

## Task List

### Task 1: Create Type Definitions (`src/lib/graph/types.ts`)
**Time:** 15 min | **Dependencies:** None | **Parallel:** Yes

Define interfaces:

```typescript
export interface ToolNode {
  id: string;
  name: string;
  type: ToolType;
  version?: string;
  reliability: number;
  debtScore: number;
  stub: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: DependencyType;
  version?: string;
  optional: boolean;
}

export interface GraphJSON {
  nodes: ToolNode[];
  edges: DependencyEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    loadedAt: string;
  };
}
```

**Verification:** Types compile without errors

---

### Task 2: Create Algorithm Implementations (`src/lib/graph/algorithms.ts`)
**Time:** 45 min | **Dependencies:** None | **Parallel:** Yes

Pure functions operating on graph data:

1. **Cycle Detection (DFS)**
   ```typescript
   export function findCycles(
     nodes: Set<string>,
     forward: Map<string, Set<string>>
   ): string[][];
   ```

2. **Topological Sort (Kahn's algorithm)**
   ```typescript
   export function topologicalSort(
     nodes: Set<string>,
     forward: Map<string, Set<string>>
   ): string[];
   ```

3. **Path Finding (BFS)**
   ```typescript
   export function findPath(
     from: string,
     to: string,
     forward: Map<string, Set<string>>
   ): string[] | null;
   ```

4. **All Paths (DFS with backtracking)**
   ```typescript
   export function findAllPaths(
     from: string,
     to: string,
     forward: Map<string, Set<string>>,
     maxPaths?: number
   ): string[][];
   ```

5. **Transitive Closure (BFS)**
   ```typescript
   export function getTransitiveClosure(
     start: string,
     adjacency: Map<string, Set<string>>
   ): Set<string>;
   ```

**Verification:** Unit tests for each algorithm

---

### Task 3: Create Database Loader (`src/lib/graph/loader.ts`)
**Time:** 30 min | **Dependencies:** Task 1

Load tools and dependencies from database:

```typescript
export async function loadGraphData(db: DbType): Promise<{
  nodes: Map<string, ToolNode>;
  edges: Map<string, DependencyEdge>;
  forward: Map<string, Set<string>>;
  reverse: Map<string, Set<string>>;
}>;
```

Steps:
1. Query all tools
2. Query all dependencies
3. Build node map
4. Build edge map with "from:to" keys
5. Build forward adjacency list
6. Build reverse adjacency list

**Verification:** Loads test data correctly

---

### Task 4: Create DependencyGraph Class (`src/lib/graph/index.ts`)
**Time:** 60 min | **Dependencies:** Tasks 1, 2, 3

Main class implementation:

```typescript
export class DependencyGraph {
  private nodes: Map<string, ToolNode>;
  private edges: Map<string, DependencyEdge>;
  private forward: Map<string, Set<string>>;
  private reverse: Map<string, Set<string>>;
  private loadedAt: Date;

  // Static factory
  static async load(db: DbType): Promise<DependencyGraph>;

  // Node access
  getNode(id: string): ToolNode | undefined;
  getAllNodes(): ToolNode[];
  hasNode(id: string): boolean;

  // Edge access
  getEdge(from: string, to: string): DependencyEdge | undefined;
  getAllEdges(): DependencyEdge[];

  // Dependency queries
  getDependencies(id: string): ToolNode[];
  getDependencyEdges(id: string): DependencyEdge[];
  getDependents(id: string): ToolNode[];
  getDependentEdges(id: string): DependencyEdge[];

  // Transitive queries
  getTransitiveDependencies(id: string): ToolNode[];
  getTransitiveDependents(id: string): ToolNode[];

  // Path queries
  findPath(from: string, to: string): string[] | null;
  findAllPaths(from: string, to: string): string[][];

  // Cycle detection
  findCycles(): string[][];
  hasCycle(): boolean;

  // Topological sort
  topologicalSort(): string[];

  // Serialization
  toJSON(): GraphJSON;

  // Stats
  nodeCount(): number;
  edgeCount(): number;
}
```

**Verification:** All methods work on test graph

---

### Task 5: Create Comprehensive Tests
**Time:** 60 min | **Dependencies:** Task 4

Create `tests/graph.test.ts`:

**Loading Tests:**
1. Loads empty database
2. Loads tools as nodes
3. Loads dependencies as edges
4. Builds forward adjacency correctly
5. Builds reverse adjacency correctly

**Node/Edge Tests:**
6. getNode returns node
7. getNode returns undefined for unknown
8. getAllNodes returns all
9. getEdge returns edge
10. getAllEdges returns all

**Dependency Tests:**
11. getDependencies returns direct deps
12. getDependents returns direct dependents
13. getTransitiveDependencies returns all reachable
14. getTransitiveDependents returns all depending

**Algorithm Tests:**
15. findPath returns shortest path
16. findPath returns null for disconnected
17. findAllPaths returns all paths
18. findCycles detects simple cycle
19. findCycles detects multiple cycles
20. findCycles returns empty for acyclic
21. topologicalSort orders correctly
22. topologicalSort handles cycles gracefully

**Serialization Tests:**
23. toJSON produces valid JSON
24. JSON contains all nodes and edges

**Verification:** `bun test tests/graph.test.ts` passes

---

### Task 6: Export from lib/index.ts
**Time:** 10 min | **Dependencies:** Task 4

Update `src/lib/index.ts`:

```typescript
export { DependencyGraph } from './graph';
export type { ToolNode, DependencyEdge, GraphJSON } from './graph/types';
```

**Verification:** Can import from `../src/lib`

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Type definitions | 15m | None |
| 2 | Algorithm implementations | 45m | None |
| 3 | Database loader | 30m | 1 |
| 4 | DependencyGraph class | 60m | 1, 2, 3 |
| 5 | Tests | 60m | 4 |
| 6 | Export | 10m | 4 |

**Total:** ~220 minutes (~4 hours)

---

## Doctorow Gate Verification

1. **Failure test:** Empty database → empty graph (no error)
2. **Failure test:** Missing node in edge → filter/ignore gracefully
3. **Assumption test:** 100 tools load in < 100ms
4. **Rollback test:** No external state
5. **Debt recorded:** Score 4

---

## Completion Marker

```
[FEATURE COMPLETE]
Feature: F-007 - In-Memory Dependency Graph
Tests: X passing
Files: src/lib/graph/types.ts, src/lib/graph/algorithms.ts, src/lib/graph/loader.ts, src/lib/graph/index.ts
Doctorow Gate: PASSED
```
