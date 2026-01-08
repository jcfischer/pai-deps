# Feature Specification: F-007 - In-Memory Dependency Graph

**Feature ID:** F-007
**Phase:** 2 (Dependency Graph)
**Priority:** 4
**Estimated Hours:** 4
**Reliability Target:** 0.95
**Dependencies:** F-004 (Register command)

---

## Summary

Implement a `DependencyGraph` class that loads tools and dependencies from the database into an in-memory adjacency list representation. This graph enables efficient traversal for dependency queries (deps, rdeps), path finding, cycle detection, and topological sorting.

---

## User Scenarios

### Scenario 1: Load Graph from Database
**Given** tools and dependencies exist in database
**When** creating a DependencyGraph instance
**Then** all tools are loaded as nodes
**And** all dependencies are loaded as edges
**And** graph is ready for queries

### Scenario 2: Query Forward Dependencies
**Given** a loaded graph
**When** calling `getDependencies(toolId)`
**Then** returns array of tools this one depends on
**And** lookup is O(1) using adjacency list

### Scenario 3: Query Reverse Dependencies
**Given** a loaded graph
**When** calling `getDependents(toolId)`
**Then** returns array of tools that depend on this one
**And** uses reverse adjacency list

### Scenario 4: Detect Cycles
**Given** a graph with circular dependency A -> B -> C -> A
**When** calling `findCycles()`
**Then** returns array containing [A, B, C, A]

---

## Functional Requirements

### FR-1: Graph Node Structure
```typescript
interface ToolNode {
  id: string;
  name: string;
  type: ToolType;
  version?: string;
  reliability: number;
  debtScore: number;
  stub: boolean;
}
```

### FR-2: Graph Edge Structure
```typescript
interface DependencyEdge {
  from: string;      // consumer_id
  to: string;        // provider_id
  type: DependencyType;
  version?: string;  // version constraint
  optional: boolean;
}
```

### FR-3: DependencyGraph Class
```typescript
class DependencyGraph {
  // Construction
  static async load(db: DbType): Promise<DependencyGraph>;

  // Node access
  getNode(id: string): ToolNode | undefined;
  getAllNodes(): ToolNode[];
  hasNode(id: string): boolean;

  // Edge access
  getEdge(from: string, to: string): DependencyEdge | undefined;
  getAllEdges(): DependencyEdge[];

  // Forward dependencies (tools this one depends on)
  getDependencies(id: string): ToolNode[];
  getDependencyEdges(id: string): DependencyEdge[];

  // Reverse dependencies (tools that depend on this one)
  getDependents(id: string): ToolNode[];
  getDependentEdges(id: string): DependencyEdge[];

  // Traversal
  getTransitiveDependencies(id: string): ToolNode[];
  getTransitiveDependents(id: string): ToolNode[];

  // Path finding
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

### FR-4: Adjacency List Representation
- Forward adjacency: `Map<string, Set<string>>` - tool -> dependencies
- Reverse adjacency: `Map<string, Set<string>>` - tool -> dependents
- Node map: `Map<string, ToolNode>` - quick node lookup
- Edge map: `Map<string, DependencyEdge>` - edge lookup by "from:to" key

### FR-5: Lazy Loading
- Graph loads on first access
- Option to reload: `await graph.reload()`
- Cache invalidation on database changes (optional)

### FR-6: Serialization
```typescript
interface GraphJSON {
  nodes: ToolNode[];
  edges: DependencyEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    loadedAt: string;
  };
}
```

---

## Non-Functional Requirements

### NFR-1: Performance
- Graph load: < 100ms for 100 tools
- Neighbor lookup: O(1)
- Transitive closure: O(V + E)
- Path finding: O(V + E) per path

### NFR-2: Memory
- Efficient storage using Maps and Sets
- No duplicate data storage

---

## Acceptance Criteria

- [ ] Graph loads from database correctly
- [ ] Forward dependencies (getDependencies) works
- [ ] Reverse dependencies (getDependents) works
- [ ] Transitive dependencies work
- [ ] Cycle detection finds all cycles
- [ ] Path finding works for connected nodes
- [ ] Topological sort handles acyclic graphs
- [ ] JSON serialization works
- [ ] All tests pass

---

## Out of Scope

- Graph visualization (F-012)
- Real-time updates (graph is snapshot)
- Distributed graph across processes

---

## References

- F-004: Register command (data source)
- Design Doc: Graph queries section
