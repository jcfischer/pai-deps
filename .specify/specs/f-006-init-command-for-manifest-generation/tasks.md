# Implementation Tasks: F-006 - Init Command for Manifest Generation

**Feature ID:** F-006
**Total Estimated Time:** 2 hours
**Parallelizable:** Tasks 1-2 parallel, then 3-5 sequential

---

## Task List

### Task 1: Create Detection Logic (`src/lib/detector.ts`)
**Time:** 20 min | **Dependencies:** None | **Parallel:** Yes

Implement package.json detection:

```typescript
export interface DetectedInfo {
  name?: string;
  version?: string;
  type?: 'cli' | 'mcp' | 'library';
  description?: string;
}

export async function detectFromPackageJson(dir: string): Promise<DetectedInfo>;
export function generateManifestTemplate(info: {...}): string;
```

Detection rules:
- name: Strip @scope/ prefix from package name
- version: Use package version
- type: "cli" if bin field, "mcp" if name/main contains "mcp", else "library"
- description: Use package description

Template generation:
- Use template literal
- Include commented example sections
- Match F-003 schema structure

**Verification:** Unit tests for detection and template generation

---

### Task 2: Create Test Fixtures
**Time:** 15 min | **Dependencies:** None | **Parallel:** Yes

Create test directories in `tests/fixtures/init/`:

1. **with-package-json/** - package.json with name, version, bin
2. **library-package/** - package.json without bin (library)
3. **mcp-package/** - package.json with mcp in name
4. **no-package-json/** - empty directory
5. **existing-manifest/** - has pai-manifest.yaml already

**Verification:** All directories created

---

### Task 3: Create Init Command (`src/commands/init.ts`)
**Time:** 30 min | **Dependencies:** Task 1

Implement the command:

1. Parse path argument
2. Check if manifest exists (error without --force)
3. Detect from package.json
4. Apply option overrides (--name, --type)
5. Generate template
6. Write to pai-manifest.yaml
7. Output success message or JSON

Options:
- --force: Overwrite existing
- --name: Override detected name
- --type: Override detected type

**Verification:** `pai-deps init --help` shows command

---

### Task 4: Wire Up in Index
**Time:** 5 min | **Dependencies:** Task 3

Update `src/index.ts`:

```typescript
import { initCommand } from './commands/init';
initCommand(program);
```

**Verification:** `pai-deps init /tmp/test` creates manifest

---

### Task 5: Create Comprehensive Tests
**Time:** 40 min | **Dependencies:** Tasks 2, 4

Create `tests/init.test.ts`:

**Detection Tests:**
1. Detects name from package.json
2. Detects version from package.json
3. Detects CLI type from bin field
4. Detects library type without bin
5. Detects MCP type from name
6. Handles missing package.json

**Command Tests:**
7. Creates manifest in directory
8. Uses directory name when no package.json
9. Errors when manifest exists
10. --force overwrites existing manifest
11. --name overrides detected name
12. --type overrides detected type
13. JSON output format correct

**Template Tests:**
14. Generated manifest is valid YAML
15. Template includes all required fields
16. Template has commented examples

**Verification:** `bun test tests/init.test.ts` passes

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Detection logic | 20m | None |
| 2 | Test fixtures | 15m | None |
| 3 | Init command | 30m | 1 |
| 4 | Wire up index | 5m | 3 |
| 5 | Tests | 40m | 2, 4 |

**Total:** ~110 minutes (~2 hours)

---

## Doctorow Gate Verification

After implementation:

1. **Failure test:** Invalid path shows clear error
2. **Failure test:** No write permission handled
3. **Rollback test:** Can delete generated manifest
4. **Debt recorded:** Score 2

---

## Completion Marker

```
[FEATURE COMPLETE]
Feature: F-006 - Init Command for Manifest Generation
Tests: X passing
Files: src/lib/detector.ts, src/commands/init.ts, tests/init.test.ts
Doctorow Gate: PASSED
```
