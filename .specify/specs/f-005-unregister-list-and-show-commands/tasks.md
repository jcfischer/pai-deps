# Implementation Tasks: F-005 - Unregister, List, and Show Commands

**Feature ID:** F-005
**Total Estimated Time:** 3 hours
**Parallelizable:** Tasks 1-3 parallel, then 4-6 parallel, then 7-8 sequential

---

## Task List

### Task 1: Create Table Formatter (`src/lib/table.ts`)
**Time:** 20 min | **Dependencies:** None | **Parallel:** Yes

Create ASCII table formatting utility:

```typescript
// src/lib/table.ts

/**
 * Format data as ASCII table with headers
 */
export function formatTable(headers: string[], rows: string[][]): string;

/**
 * Format a tree structure with box-drawing characters
 */
export function formatTree(items: string[], indent: number = 0): string;
```

Features:
- Auto-calculate column widths
- Pad columns for alignment
- Unicode separator line (─)
- Support for tree structure (├── └──)

**Verification:** Unit test produces expected table output

---

### Task 2: Create Shared Queries (`src/lib/queries.ts`)
**Time:** 15 min | **Dependencies:** None | **Parallel:** Yes

Create shared database query functions:

```typescript
// src/lib/queries.ts

/**
 * Get tool by ID with existence check
 */
export async function getToolById(db: DbType, toolId: string): Promise<Tool | null>;

/**
 * Get all dependencies for a tool (tools it depends on)
 */
export async function getToolDependencies(db: DbType, toolId: string): Promise<Dependency[]>;

/**
 * Get all dependents (tools that depend on this one)
 */
export async function getToolDependents(db: DbType, toolId: string): Promise<Dependency[]>;

/**
 * Count dependencies for a tool
 */
export async function countDependencies(db: DbType, toolId: string): Promise<number>;
```

**Verification:** Queries return expected results on test database

---

### Task 3: Implement List Command (`src/commands/list.ts`)
**Time:** 30 min | **Dependencies:** Task 1 | **Parallel:** Yes (after Task 1)

Implement `pai-deps list` command:

1. Command definition with options:
   - `--type <type>` filter
   - `--stubs` / `--no-stubs` flags
   - Inherits global `--json` flag

2. Query all tools from database with filters

3. For each tool, count dependencies (use LEFT JOIN or subquery)

4. Human-readable output:
   - ASCII table with columns: ID, Type, Version, Deps, Reliability, Debt, Status
   - Footer with total count and stub count
   - Empty state: "No tools registered"

5. JSON output:
   - `{ success: true, tools: [...], total: N, stubs: N }`

**Verification:** `pai-deps list` shows table, `--json` shows JSON

---

### Task 4: Implement Show Command (`src/commands/show.ts`)
**Time:** 30 min | **Dependencies:** Task 2 | **Parallel:** Yes (after Task 2)

Implement `pai-deps show <tool>` command:

1. Command definition with tool argument

2. Lookup tool by ID, error if not found

3. Get dependencies (tools this one depends on)

4. Get dependents (tools that depend on this one)

5. Try to read provides from manifest (handle missing gracefully)

6. Human-readable output:
   - Tool info (name, version, type, path)
   - Metrics (reliability, debt score, last verified)
   - Dependencies tree
   - Dependents tree
   - Provides section (if available)

7. JSON output:
   - Full tool object
   - Dependencies array
   - Dependents array
   - Provides object

**Verification:** `pai-deps show email` displays details

---

### Task 5: Implement Unregister Command (`src/commands/unregister.ts`)
**Time:** 25 min | **Dependencies:** Task 2 | **Parallel:** Yes (after Task 2)

Implement `pai-deps unregister <tool>` command:

1. Command definition with tool argument and --force option

2. Lookup tool by ID, error if not found

3. Check for dependents:
   - If dependents exist and no --force: show warning, exit 1
   - If --force or no dependents: proceed

4. Delete tool (CASCADE handles consumer dependencies)

5. Human-readable output:
   - "Unregistered <tool>"
   - Warning if dependents existed

6. JSON output:
   - `{ success: true, action: "unregistered", tool: "...", affectedDependents: [...] }`

**Verification:** `pai-deps unregister email` removes tool

---

### Task 6: Wire Up Commands in Index
**Time:** 10 min | **Dependencies:** Tasks 3, 4, 5

Update `src/index.ts`:

```typescript
import { listCommand } from './commands/list';
import { showCommand } from './commands/show';
import { unregisterCommand } from './commands/unregister';

// After program setup
listCommand(program);
showCommand(program);
unregisterCommand(program);
```

**Verification:** All three commands appear in `pai-deps --help`

---

### Task 7: Create Test Fixtures
**Time:** 15 min | **Dependencies:** None

Extend test fixtures for list/show/unregister tests:

1. Ensure register fixtures can be reused
2. Create scenarios:
   - Tool with dependencies
   - Tool with dependents
   - Stub tool
   - Tool with provides

**Verification:** Fixtures created and valid

---

### Task 8: Create Comprehensive Tests
**Time:** 45 min | **Dependencies:** Tasks 6, 7

Create `tests/list-show-unregister.test.ts`:

**List Tests:**
1. Lists all registered tools
2. Shows tool count and stub count
3. Filters by type
4. Shows only stubs with --stubs
5. Hides stubs with --no-stubs
6. Shows "No tools registered" when empty
7. JSON output format correct

**Show Tests:**
8. Shows tool details
9. Shows dependencies with types and versions
10. Shows dependents
11. Shows provides from manifest
12. Errors for unknown tool
13. JSON output format correct

**Unregister Tests:**
14. Removes tool from database
15. Dependencies as consumer are removed (CASCADE)
16. Errors for unknown tool
17. Warns when tool has dependents
18. Requires --force when dependents exist
19. Succeeds with --force
20. JSON output format correct

**Verification:** `bun test tests/list-show-unregister.test.ts` passes all tests

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Table formatter | 20m | None |
| 2 | Shared queries | 15m | None |
| 3 | List command | 30m | 1 |
| 4 | Show command | 30m | 2 |
| 5 | Unregister command | 25m | 2 |
| 6 | Wire up index | 10m | 3, 4, 5 |
| 7 | Test fixtures | 15m | None |
| 8 | Tests | 45m | 6, 7 |

**Total:** ~190 minutes (~3 hours)

---

## Doctorow Gate Verification

After implementation, verify:

1. **Failure test:** Non-existent tool in show/unregister produces clear error
2. **Failure test:** Missing manifest in show still works (without provides)
3. **Assumption test:** List handles 100+ tools performantly
4. **Rollback test:** Re-register after unregister restores tool
5. **Debt recorded:** Add entry to debt-ledger with score 3

---

## Completion Marker

When done, output:
```
[FEATURE COMPLETE]
Feature: F-005 - Unregister, List, and Show Commands
Tests: X passing
Files: src/lib/table.ts, src/lib/queries.ts, src/commands/list.ts, src/commands/show.ts, src/commands/unregister.ts
Doctorow Gate: PASSED
```
