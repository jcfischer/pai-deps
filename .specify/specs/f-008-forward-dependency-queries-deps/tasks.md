# Implementation Tasks: F-008 - Forward Dependency Queries (deps)

**Feature ID:** F-008
**Total Estimated Time:** 2 hours
**Parallelizable:** Tasks 1-2 parallel, then 3-5 sequential

---

## Task List

### Task 1: Create deps command structure (`src/commands/deps.ts`)
**Time:** 30 min | **Dependencies:** None

Create the command file with basic structure:

```typescript
import { Command } from 'commander';
import { getDb } from '../db/index.js';
import { DependencyGraph } from '../lib/graph/index.js';
import { output, success, failure } from '../lib/output.js';

interface DepsOptions {
  transitive?: boolean;
}

export function depsCommand(program: Command): void {
  program
    .command('deps')
    .description('Show forward dependencies (what a tool depends on)')
    .argument('<tool>', 'Tool ID to query')
    .option('-t, --transitive', 'Include transitive dependencies')
    .action(async (toolId: string, options: DepsOptions) => {
      // Implementation
    });
}
```

**Verification:** Command shows in `--help` output

---

### Task 2: Implement table output formatting
**Time:** 20 min | **Dependencies:** Task 1

Format dependencies as ASCII table:

```typescript
function formatTable(
  toolId: string,
  deps: DependencyInfo[],
  transitive: boolean
): string {
  if (deps.length === 0) {
    return `Tool '${toolId}' has no dependencies.`;
  }

  const header = transitive
    ? `Dependencies for: ${toolId} (transitive)\n`
    : `Dependencies for: ${toolId}\n`;

  const columns = transitive
    ? ['ID', 'Name', 'Type', 'Reliability', 'Depth']
    : ['ID', 'Name', 'Type', 'Reliability'];

  // Build table rows
  const rows = deps.map(d => transitive
    ? [d.id, d.name, d.type, d.reliability.toFixed(2), String(d.depth)]
    : [d.id, d.name, d.type, d.reliability.toFixed(2)]
  );

  // Format as aligned columns
  return header + formatColumns(columns, rows);
}
```

**Verification:** Table output aligns columns correctly

---

### Task 3: Implement JSON output formatting
**Time:** 15 min | **Dependencies:** Task 1

Format as JSON matching spec:

```typescript
interface DepsResult {
  tool: string;
  transitive: boolean;
  dependencies: DependencyInfo[];
  count: number;
}

function formatJson(
  toolId: string,
  deps: DependencyInfo[],
  transitive: boolean
): DepsResult {
  return {
    tool: toolId,
    transitive,
    dependencies: deps,
    count: deps.length,
  };
}
```

**Verification:** JSON output is valid and matches schema

---

### Task 4: Implement transitive depth calculation
**Time:** 30 min | **Dependencies:** Task 1

Add BFS-based depth tracking:

```typescript
interface DependencyInfo {
  id: string;
  name: string;
  type: string;
  reliability: number;
  depth?: number;
}

function getTransitiveWithDepth(
  graph: DependencyGraph,
  startId: string
): DependencyInfo[] {
  const depths = new Map<string, number>();
  const queue: [string, number][] = [];

  // Start with direct dependencies at depth 1
  for (const dep of graph.getDependencies(startId)) {
    queue.push([dep.id, 1]);
    depths.set(dep.id, 1);
  }

  // BFS
  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;
    for (const next of graph.getDependencies(current)) {
      if (!depths.has(next.id)) {
        depths.set(next.id, depth + 1);
        queue.push([next.id, depth + 1]);
      }
    }
  }

  // Build result with nodes and depths
  const result: DependencyInfo[] = [];
  for (const [id, depth] of depths) {
    const node = graph.getNode(id);
    if (node) {
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        reliability: node.reliability,
        depth,
      });
    }
  }

  // Sort by depth, then by name
  return result.sort((a, b) =>
    a.depth! - b.depth! || a.name.localeCompare(b.name)
  );
}
```

**Verification:** Depths are correct for multi-level dependencies

---

### Task 5: Register command and test
**Time:** 25 min | **Dependencies:** Tasks 1-4

1. Register in `src/index.ts`:
```typescript
import { depsCommand } from './commands/deps.js';
// ...
depsCommand(program);
```

2. Create tests `tests/deps.test.ts`:

```typescript
describe('deps command', () => {
  // Setup: create test DB with tools and dependencies

  it('shows direct dependencies', async () => {
    // Test: pai-deps deps A -> shows B, C
  });

  it('shows transitive dependencies', async () => {
    // Test: pai-deps deps A --transitive -> shows B, C, D
  });

  it('includes depth for transitive', async () => {
    // Test: B at depth 1, D at depth 2
  });

  it('returns JSON with --json', async () => {
    // Test: valid JSON matching schema
  });

  it('errors for unknown tool', async () => {
    // Test: exit code 1, error message
  });

  it('handles tool with no dependencies', async () => {
    // Test: success message, exit code 0
  });
});
```

**Verification:** `bun test tests/deps.test.ts` passes

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Command structure | 30m | None |
| 2 | Table output | 20m | 1 |
| 3 | JSON output | 15m | 1 |
| 4 | Transitive depth | 30m | 1 |
| 5 | Register + tests | 25m | 1-4 |

**Total:** ~120 minutes (~2 hours)

---

## Doctorow Gate Verification

1. **Failure test:** Unknown tool → clear error message
2. **Failure test:** Empty database → works without crash
3. **Assumption test:** Circular deps don't cause infinite loop (BFS uses visited set)
4. **Rollback test:** Read-only, no state to roll back
5. **Debt recorded:** Score 3

---

## Completion Marker

```
[FEATURE COMPLETE]
Feature: F-008 - Forward Dependency Queries (deps)
Tests: X passing
Files: src/commands/deps.ts, tests/deps.test.ts
Doctorow Gate: PASSED
```
