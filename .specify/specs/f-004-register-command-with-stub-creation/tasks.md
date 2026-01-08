# Implementation Tasks: F-004 - Register Command with Stub Creation

**Feature ID:** F-004
**Total Estimated Time:** 4 hours
**Parallelizable:** Tasks 1-2 parallel, then 3-5 sequential, then 6-7 sequential

---

## Task List

### Task 1: Create Cycle Detection Utility (`src/lib/graph.ts`)
**Time:** 30 min | **Dependencies:** F-002 | **Parallel:** Yes

Implement cycle detection using DFS:

```typescript
// src/lib/graph.ts
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type * as schema from '../db/schema';

type DbType = BunSQLiteDatabase<typeof schema>;

export async function detectCycles(db: DbType, startToolId: string): Promise<string[][]>;
```

Algorithm:
1. Start DFS from the given tool
2. Track visited nodes and recursion stack
3. When reaching a node already in recursion stack, record cycle
4. Return array of cycles (each cycle is array of tool IDs)

**Verification:** Unit test finds cycles in test graph

---

### Task 2: Create Manifest Path Resolver
**Time:** 15 min | **Dependencies:** None | **Parallel:** Yes

Add to `src/lib/manifest.ts` or create `src/lib/paths.ts`:

```typescript
export function resolveManifestPath(inputPath: string): string {
  // 1. Resolve to absolute path
  // 2. If directory, append pai-manifest.yaml
  // 3. If file, use directly
  // 4. Verify file exists
  // 5. Return absolute path or throw clear error
}
```

**Verification:** Handles directory and file paths correctly

---

### Task 3: Create Registry Logic (`src/lib/registry.ts`)
**Time:** 60 min | **Dependencies:** Tasks 1, 2

Implement core registration logic:

1. **`registerTool(inputPath, opts): Promise<RegisterResult>`**
   - Resolve manifest path
   - Parse manifest with F-003 parser
   - Check if tool exists (for update vs create)
   - Use database transaction for atomicity
   - Upsert tool record
   - Delete existing dependencies if updating
   - Process each dependency:
     - Check if provider exists
     - Create stub if missing
     - Create dependency edge
   - Detect cycles after transaction
   - Store cycles in circular_deps table
   - Return structured result with warnings

2. **Helper functions:**
   - `mapDepTypeToToolType(depType)`: Map dependency type to tool type
   - `countProvides(provides)`: Count CLI/MCP/library/database entries

**Verification:** Can register a test manifest to test database

---

### Task 4: Create Register Command (`src/commands/register.ts`)
**Time:** 30 min | **Dependencies:** Task 3

Implement Commander.js command:

```typescript
import { Command } from 'commander';
import { registerTool } from '../lib/registry';
import { output, log, warn } from '../lib/output';

export function registerCommand(program: Command) {
  program
    .command('register <path>')
    .description('Register a tool from pai-manifest.yaml')
    .action(async (path: string) => {
      const opts = program.opts();
      try {
        const result = await registerTool(path, opts);

        // Show warnings
        for (const warning of result.warnings) {
          warn(warning, opts);
        }

        // Output result
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          const action = result.action === 'updated' ? 'Updated' : 'Registered';
          log(`${action} ${result.tool.name}${result.tool.version ? ` v${result.tool.version}` : ''}`, opts);
          log(`  Dependencies: ${result.tool.dependencies}`, opts);
          // ... more human-readable output
        }
      } catch (error) {
        output({ success: false, error: error.message }, opts);
      }
    });
}
```

**Verification:** `pai-deps register --help` shows command

---

### Task 5: Wire Up Command in Index
**Time:** 15 min | **Dependencies:** Task 4

Update `src/index.ts`:

```typescript
import { registerCommand } from './commands/register';

// After program setup
registerCommand(program);
```

**Verification:** `pai-deps register /path/to/tool` works

---

### Task 6: Create Test Fixtures
**Time:** 20 min | **Dependencies:** None

Create test manifests in `tests/fixtures/register/`:

1. **simple-tool/pai-manifest.yaml** - Minimal tool, no deps
2. **tool-with-deps/pai-manifest.yaml** - Tool with 2 dependencies
3. **tool-with-missing-dep/pai-manifest.yaml** - Depends on non-existent tool
4. **circular-a/pai-manifest.yaml** - Tool A depends on B
5. **circular-b/pai-manifest.yaml** - Tool B depends on A

**Verification:** All fixtures have valid YAML syntax

---

### Task 7: Create Comprehensive Tests
**Time:** 60 min | **Dependencies:** Tasks 5, 6

Create `tests/register.test.ts`:

**Registration Tests:**
1. Registers tool from valid manifest
2. Tool stored in database with correct fields
3. Dependencies created as edges
4. Version, reliability, debt_score stored correctly

**Stub Tests:**
5. Missing dependency creates stub entry
6. Stub has stub=1 flag
7. Warning emitted for stub creation
8. Edge created pointing to stub

**Update Tests:**
9. Updating existing tool modifies record
10. Old dependencies removed on update
11. New dependencies added on update
12. Action is "updated" not "registered"

**Cycle Tests:**
13. Circular dependency detected
14. Cycle stored in circular_deps table
15. Warning emitted for cycle
16. Registration still succeeds (not blocked)

**Error Tests:**
17. Invalid path shows clear error
18. Missing manifest shows clear error
19. Invalid manifest shows parse error

**JSON Output Tests:**
20. --json outputs valid JSON
21. JSON includes tool details
22. JSON includes warnings array

**Verification:** `bun test tests/register.test.ts` passes all tests

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Cycle detection utility | 30m | F-002 |
| 2 | Manifest path resolver | 15m | None |
| 3 | Registry logic | 60m | 1, 2 |
| 4 | Register command | 30m | 3 |
| 5 | Wire up in index | 15m | 4 |
| 6 | Test fixtures | 20m | None |
| 7 | Comprehensive tests | 60m | 5, 6 |

**Total:** ~230 minutes (~4 hours)

---

## Doctorow Gate Verification

After implementation, verify:

1. **Failure test:** Invalid path produces clear error message
2. **Failure test:** Malformed manifest produces parse error with details
3. **Failure test:** Database constraint violation handled gracefully
4. **Assumption test:** Can handle 50+ dependencies per tool
5. **Rollback test:** Unregister command (F-005) can reverse registration
6. **Debt recorded:** Add entry to debt-ledger with score 4

---

## Completion Marker

When done, output:
```
[FEATURE COMPLETE]
Feature: F-004 - Register Command with Stub Creation
Tests: X passing
Files: src/lib/graph.ts, src/lib/registry.ts, src/commands/register.ts, tests/register.test.ts
Doctorow Gate: PASSED
```
