# Technical Plan: F-004 - Register Command with Stub Creation

**Feature ID:** F-004
**Phase:** 1 (Core Registry)
**Estimated Hours:** 4

---

## Approach

Implement the register command as a Commander.js subcommand in `src/commands/register.ts`. Use Drizzle ORM transactions to ensure atomic database operations. Implement cycle detection using DFS on the dependency graph.

---

## Technical Design

### Architecture

```
src/
├── commands/
│   └── register.ts      # Register command implementation
├── lib/
│   ├── manifest.ts      # (F-003) Manifest parser
│   ├── graph.ts         # Cycle detection utilities
│   └── registry.ts      # Tool registration logic
└── index.ts             # Wire up register command
```

### Dependencies

Uses existing:
- F-002: Database (tools, dependencies, circular_deps tables)
- F-003: Manifest parser (parseManifest, Manifest type)

### Register Command (`src/commands/register.ts`)

```typescript
import { Command } from 'commander';
import { registerTool } from '../lib/registry';
import { output } from '../lib/output';
import type { GlobalOptions } from '../types';

export function registerCommand(program: Command) {
  program
    .command('register <path>')
    .description('Register a tool from pai-manifest.yaml')
    .action(async (path: string) => {
      const opts = program.opts() as GlobalOptions;
      const result = await registerTool(path, opts);
      output(result, opts);
    });
}
```

### Registry Logic (`src/lib/registry.ts`)

```typescript
import { getDb } from '../db';
import { tools, dependencies, circularDeps } from '../db/schema';
import { parseManifest } from './manifest';
import { detectCycles } from './graph';
import { eq } from 'drizzle-orm';
import { resolve, dirname, join } from 'node:path';
import { existsSync, statSync } from 'node:fs';

interface RegisterResult {
  success: boolean;
  action: 'registered' | 'updated';
  tool: {
    id: string;
    name: string;
    version?: string;
    type: string;
    path: string;
    dependencies: number;
    provides: { cli?: number; mcp?: number; library?: number; database?: number };
  };
  warnings: string[];
  error?: string;
}

export async function registerTool(inputPath: string, opts: GlobalOptions): Promise<RegisterResult> {
  // 1. Resolve manifest path
  const manifestPath = resolveManifestPath(inputPath);

  // 2. Parse manifest
  const manifest = parseManifest(manifestPath);

  // 3. Get database connection
  const db = await getDb();

  // 4. Check if tool already exists
  const existing = await db.select().from(tools).where(eq(tools.id, manifest.name));
  const isUpdate = existing.length > 0;

  // 5. Use transaction for atomic operations
  const warnings: string[] = [];

  await db.transaction(async (tx) => {
    // 5a. Upsert tool
    const toolData = {
      id: manifest.name,
      name: manifest.name,
      path: dirname(manifestPath),
      type: manifest.type,
      version: manifest.version ?? null,
      reliability: manifest.reliability,
      debtScore: manifest.debt_score,
      manifestPath,
      stub: 0,
      lastVerified: null,
      updatedAt: new Date().toISOString(),
    };

    if (isUpdate) {
      await tx.update(tools).set(toolData).where(eq(tools.id, manifest.name));
      // Delete existing dependencies for this consumer
      await tx.delete(dependencies).where(eq(dependencies.consumerId, manifest.name));
    } else {
      await tx.insert(tools).values({
        ...toolData,
        createdAt: new Date().toISOString(),
      });
    }

    // 5b. Process dependencies
    for (const dep of manifest.depends_on ?? []) {
      // Check if provider exists
      const provider = await tx.select().from(tools).where(eq(tools.id, dep.name));

      if (provider.length === 0) {
        // Create stub
        await tx.insert(tools).values({
          id: dep.name,
          name: dep.name,
          path: 'unknown',
          type: mapDepTypeToToolType(dep.type),
          stub: 1,
          reliability: 0.95,
          debtScore: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        warnings.push(`Created stub for unregistered dependency: ${dep.name}`);
      }

      // Create dependency edge
      await tx.insert(dependencies).values({
        consumerId: manifest.name,
        providerId: dep.name,
        type: dep.type,
        versionConstraint: dep.version ?? null,
        optional: dep.optional ? 1 : 0,
        createdAt: new Date().toISOString(),
      });
    }
  });

  // 6. Detect cycles (outside transaction)
  const cycles = await detectCycles(db, manifest.name);
  for (const cycle of cycles) {
    await db.insert(circularDeps).values({
      cycle: JSON.stringify(cycle),
      detectedAt: new Date().toISOString(),
      resolved: 0,
    });
    warnings.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
  }

  // 7. Build result
  return {
    success: true,
    action: isUpdate ? 'updated' : 'registered',
    tool: {
      id: manifest.name,
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      path: dirname(manifestPath),
      dependencies: (manifest.depends_on ?? []).length,
      provides: countProvides(manifest.provides),
    },
    warnings,
  };
}
```

### Cycle Detection (`src/lib/graph.ts`)

```typescript
import type { DrizzleDb } from '../db';
import { dependencies } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function detectCycles(db: DrizzleDb, startToolId: string): Promise<string[][]> {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  async function dfs(toolId: string): Promise<void> {
    visited.add(toolId);
    recursionStack.add(toolId);
    path.push(toolId);

    // Get all dependencies of this tool
    const deps = await db.select().from(dependencies).where(eq(dependencies.consumerId, toolId));

    for (const dep of deps) {
      if (!visited.has(dep.providerId)) {
        await dfs(dep.providerId);
      } else if (recursionStack.has(dep.providerId)) {
        // Found cycle
        const cycleStart = path.indexOf(dep.providerId);
        const cycle = [...path.slice(cycleStart), dep.providerId];
        cycles.push(cycle);
      }
    }

    path.pop();
    recursionStack.delete(toolId);
  }

  await dfs(startToolId);
  return cycles;
}
```

---

## Failure Mode Analysis

### How This Code Can Fail

| Failure Mode | Trigger | Detection | Degradation | Recovery |
|--------------|---------|-----------|-------------|----------|
| Manifest not found | Invalid path | File check | Clear error | User fixes path |
| Invalid manifest | Bad YAML/schema | Parse error | Clear error | User fixes manifest |
| Database locked | Concurrent access | SQLite error | Retry once | User retries |
| Cycle detection timeout | Deep graph | Timeout | Skip cycle detection | Limit depth |

### Assumptions That Could Break

| Assumption | What Would Invalidate It | Detection Strategy |
|------------|-------------------------|-------------------|
| Tool names are unique | Name collision | Constraint violation |
| Dependencies are resolvable | Tool doesn't exist | Stub creation |
| Graph is finite | Very large ecosystem | Test with 100+ tools |

### Blast Radius

- **Files touched:** 4 new/modified files
- **Systems affected:** Database (tools, dependencies, circular_deps tables)
- **Rollback strategy:** Unregister command can reverse

---

## Implementation Steps

1. Create `src/lib/graph.ts` with cycle detection
2. Create `src/lib/registry.ts` with registration logic
3. Create `src/commands/register.ts` with command definition
4. Wire up command in `src/index.ts`
5. Create comprehensive tests
6. Test with real manifests

---

## Testing Strategy

### Unit Tests

```typescript
describe('Register Command', () => {
  test('registers tool from valid manifest', async () => {
    // Setup: create manifest file
    // Action: call registerTool
    // Assert: tool in database, dependencies linked
  });

  test('creates stub for missing dependency', async () => {
    // Setup: manifest depends on non-existent tool
    // Action: register
    // Assert: stub created with stub=1, warning emitted
  });

  test('updates existing tool', async () => {
    // Setup: register once, modify manifest
    // Action: register again
    // Assert: updated, not duplicated
  });

  test('detects circular dependency', async () => {
    // Setup: A -> B, B -> A
    // Action: register A
    // Assert: cycle in circular_deps table
  });
});
```

---

## Doctorow Gate Checklist

- [ ] **Failure test:** What happens with invalid path? (clear error)
- [ ] **Failure test:** What happens with malformed manifest? (parse error)
- [ ] **Failure test:** What happens if database is locked? (retry/error)
- [ ] **Assumption test:** Handles 100+ tools? (test)
- [ ] **Rollback test:** Can unregister reverse this? (F-005)
- [ ] **Debt recorded:** Score 4 (core functionality, many edge cases)

---

## References

- Spec: `/Users/fischer/work/pai-deps/.specify/specs/f-004-register-command-with-stub-creation/spec.md`
- F-002 Database: `/Users/fischer/work/pai-deps/.specify/specs/f-002-sqlite-database-schema-with-drizzle/`
- F-003 Manifest: `/Users/fischer/work/pai-deps/.specify/specs/f-003-manifest-specification-and-zod-parser/`
