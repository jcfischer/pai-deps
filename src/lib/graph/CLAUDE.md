# src/lib/graph/ - Dependency Graph Algorithms

In-memory graph data structure for dependency queries.

## Architecture

```
graph/
├── index.ts      # DependencyGraph class (main export)
├── types.ts      # ToolNode, DependencyEdge, GraphJSON types
└── algorithms.ts # BFS/DFS implementations (if extracted)
```

## DependencyGraph Class

The main class that holds the graph and provides query methods.

### Loading from Database
```typescript
import { DependencyGraph } from './graph/index.js';

const db = getDb();
const graph = await DependencyGraph.load(db);
```

### Key Methods

| Method | Description | Algorithm |
|--------|-------------|-----------|
| `hasNode(id)` | Check if tool exists | O(1) lookup |
| `getNode(id)` | Get tool node | O(1) lookup |
| `getDependencies(id)` | Direct forward deps | O(1) lookup |
| `getDependents(id)` | Direct reverse deps | O(1) lookup |
| `getTransitiveDependencies(id)` | All forward deps | BFS |
| `getTransitiveDependents(id)` | All reverse deps | BFS |
| `findPath(from, to)` | Shortest path | BFS |
| `findAllPaths(from, to, limit)` | All paths | DFS |
| `detectCycles()` | Find circular deps | Tarjan's SCC |
| `toJSON()` | Serialize graph | - |

### Graph Structure

```typescript
interface ToolNode {
  id: string;
  name: string;
  type: 'cli' | 'mcp' | 'library' | 'workflow' | 'hook';
  path: string;
  reliability: number;
  debtScore: number;
  stub: boolean;
}

interface DependencyEdge {
  from: string;      // consumer tool ID
  to: string;        // provider tool ID
  type: string;      // dependency type
  optional: boolean;
}
```

## Algorithm Notes

### BFS for Shortest Path
Used in `findPath()`. Standard breadth-first search tracking parent pointers.

### DFS for All Paths
Used in `findAllPaths()`. Recursive DFS with visited set to avoid cycles.
Limited by `maxPaths` parameter to prevent explosion.

### Cycle Detection
Uses depth-first traversal with "visiting" state to detect back edges.
Cycles are stored in the `circularDeps` table.

## Handling Circular Dependencies

The graph can contain cycles (A → B → C → A). All algorithms handle this:
- BFS/DFS use visited sets
- Transitive queries exclude the start node from results
- `detectCycles()` reports cycles without infinite loops

## Testing

Tests in `tests/graph.test.ts` cover:
- Basic node/edge operations
- Transitive queries
- Path finding
- Cycle detection
- Diamond dependency patterns
