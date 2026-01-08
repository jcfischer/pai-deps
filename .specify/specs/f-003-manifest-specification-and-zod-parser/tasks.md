# Implementation Tasks: F-003 - Manifest Specification and Zod Parser

**Feature ID:** F-003
**Total Estimated Time:** 3 hours
**Parallelizable:** Tasks 1-2 sequential, 3-4 parallel, then 5-7 sequential

---

## Task List

### Task 1: Add Dependencies
**Time:** 10 min | **Dependencies:** F-001 complete

Update package.json to add:
```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "yaml": "^2.4.0",
    "zod-to-json-schema": "^3.22.0"
  }
}
```

Run `bun install`.

**Verification:** `bun install` succeeds, packages available for import

---

### Task 2: Create Zod Schema (`src/lib/manifest.ts`)
**Time:** 45 min | **Dependencies:** Task 1

Implement the complete manifest schema:

1. **Enum schemas:**
   - `ToolTypeSchema`: cli | mcp | library | workflow | hook | cli+mcp
   - `DependencyTypeSchema`: cli | mcp | library | database | npm | implicit

2. **Provides sub-schemas:**
   - `CliProvidesSchema`: { command, output_schema? }
   - `McpToolProvidesSchema`: { tool, schema? }
   - `McpResourceProvidesSchema`: { resource, schema? }
   - `LibraryProvidesSchema`: { export, path? }
   - `DatabaseProvidesSchema`: { path, schema? }
   - `ProvidesSectionSchema`: { cli?, mcp?, library?, database? }

3. **DependsOnEntrySchema:**
   - name (required)
   - type (required)
   - version (optional)
   - import (optional)
   - commands (optional array)
   - optional (default false)

4. **ManifestSchema:**
   - name (required, min 1)
   - version (optional)
   - type (required)
   - description (optional)
   - provides (optional)
   - depends_on (optional, default [])
   - reliability (0-1, default 0.95)
   - debt_score (int >= 0, default 0)

5. **Export inferred types:**
   - Manifest, ProvidesSection, DependsOnEntry
   - CliProvides, McpProvides, LibraryProvides, DatabaseProvides
   - ToolType, DependencyType

**Verification:** `bun run typecheck` passes, types correctly inferred

---

### Task 3: Implement Parse Functions
**Time:** 30 min | **Dependencies:** Task 2 | **Parallel:** Yes

Add to `src/lib/manifest.ts`:

1. **`parseManifest(filePath: string): Manifest`**
   - Read file with Bun.file() or readFileSync
   - Parse YAML using yaml package
   - Validate with Zod safeParse
   - Format errors with field paths
   - Throw Error with formatted message on failure

2. **`validateManifest(content: unknown)`**
   - Return `{ success: true, data: Manifest }` or `{ success: false, error: ZodError }`
   - No filesystem access required
   - Can be used for testing without files

**Verification:** Can parse a sample manifest YAML string

---

### Task 4: Create Test Fixtures
**Time:** 15 min | **Dependencies:** Task 2 | **Parallel:** Yes

Create test fixtures in `tests/fixtures/manifests/`:

1. **valid-minimal.yaml** - Just name and type
2. **valid-full.yaml** - All fields populated
3. **valid-cli.yaml** - CLI tool with provides.cli
4. **valid-mcp.yaml** - MCP server with provides.mcp
5. **invalid-missing-name.yaml** - Missing name field
6. **invalid-missing-type.yaml** - Missing type field
7. **invalid-type.yaml** - Invalid type enum value
8. **invalid-reliability.yaml** - reliability > 1

**Verification:** All fixtures created and valid YAML syntax

---

### Task 5: Generate JSON Schema
**Time:** 20 min | **Dependencies:** Task 2

1. Create `scripts/generate-schema.ts`:
   ```typescript
   import { zodToJsonSchema } from 'zod-to-json-schema';
   import { ManifestSchema } from '../src/lib/manifest';

   const schema = zodToJsonSchema(ManifestSchema, {
     name: 'PaiManifest',
     $refStrategy: 'none',
   });

   await Bun.write('./schemas/manifest.json', JSON.stringify(schema, null, 2));
   console.log('Generated schemas/manifest.json');
   ```

2. Add npm script to package.json:
   ```json
   "scripts": {
     "generate:schema": "bun run scripts/generate-schema.ts"
   }
   ```

3. Run `bun run generate:schema`

**Verification:** `schemas/manifest.json` exists with valid JSON Schema

---

### Task 6: Create Comprehensive Tests
**Time:** 45 min | **Dependencies:** Tasks 3, 4

Create `tests/manifest.test.ts`:

**Validation Tests:**
1. Valid minimal manifest - name + type only, check defaults
2. Valid full manifest - all fields populated
3. Valid CLI manifest with provides.cli
4. Valid MCP manifest with provides.mcp
5. Valid library manifest
6. Invalid - missing name field
7. Invalid - missing type field
8. Invalid - wrong type enum
9. Invalid - reliability out of range (< 0, > 1)
10. Invalid - negative debt_score

**Parse Tests:**
1. Parse valid YAML file
2. Parse file with defaults applied
3. Error on missing file
4. Error on malformed YAML
5. Error message includes field path

**Edge Cases:**
1. Empty depends_on array
2. Empty provides object
3. Unicode characters in name/description
4. Very long strings

**Verification:** `bun test tests/manifest.test.ts` passes all tests

---

### Task 7: Export from Index
**Time:** 10 min | **Dependencies:** Task 6

1. Create or update `src/lib/index.ts`:
   ```typescript
   export * from './manifest';
   export * from './output';
   ```

2. Ensure all types and functions are exported

**Verification:** Can import `{ parseManifest, Manifest }` from `../src/lib`

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Add dependencies | 10m | F-001 |
| 2 | Create Zod schema | 45m | 1 |
| 3 | Implement parse functions | 30m | 2 |
| 4 | Create test fixtures | 15m | 2 |
| 5 | Generate JSON Schema | 20m | 2 |
| 6 | Create tests | 45m | 3, 4 |
| 7 | Export from index | 10m | 6 |

**Total:** ~175 minutes (~3 hours)

---

## Doctorow Gate Verification

After implementation, verify:

1. **Failure test:** Malformed YAML produces clear syntax error
2. **Failure test:** Missing file produces clear error with path
3. **Failure test:** Invalid field produces error with field path
4. **Assumption test:** Complex nested YAML parses correctly
5. **Rollback test:** Can delete manifest.ts without affecting other features
6. **Debt recorded:** Add entry to debt-ledger with score 3

---

## Completion Marker

When done, output:
```
[FEATURE COMPLETE]
Feature: F-003 - Manifest Specification and Zod Parser
Tests: X passing
Files: src/lib/manifest.ts, schemas/manifest.json, tests/manifest.test.ts, tests/fixtures/manifests/*
Doctorow Gate: PASSED
```
