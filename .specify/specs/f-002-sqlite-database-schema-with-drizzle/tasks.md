# Implementation Tasks: F-002 - SQLite Database Schema with Drizzle

**Feature ID:** F-002
**Total Estimated Time:** 3 hours
**Parallelizable:** Tasks 1-3 sequential, then 4-5 parallel, then 6-7 sequential

---

## Task List

### Task 1: Add Drizzle Dependencies
**Time:** 10 min | **Dependencies:** F-001 complete

Update package.json to add Drizzle ORM dependencies:

```json
{
  "dependencies": {
    "commander": "^12.1.0",
    "drizzle-orm": "^0.29.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.0",
    "drizzle-kit": "^0.20.0"
  }
}
```

Run `bun install` to install dependencies.

**Verification:** `bun install` succeeds without errors

---

### Task 2: Create Database Schema (`src/db/schema.ts`)
**Time:** 30 min | **Dependencies:** Task 1

Create the schema file with all 5 tables using Drizzle ORM with bun:sqlite:

1. **tools** table - id (PK), name, path, type, version, reliability, debtScore, manifestPath, stub, lastVerified, createdAt, updatedAt
2. **dependencies** table - id (PK auto), consumerId (FK), providerId (FK), type, versionConstraint, optional, createdAt
3. **contracts** table - id (PK auto), toolId (FK), contractType, name, schemaPath, schemaHash, lastVerified, status
4. **verifications** table - id (PK auto), contractId (FK), verifiedAt, status, details, gitCommit
5. **circularDeps** table - id (PK auto), cycle, detectedAt, resolved

Include indexes:
- idx_tools_type, idx_tools_stub
- idx_deps_consumer, idx_deps_provider
- idx_contracts_tool
- idx_verifications_contract

**Verification:** `bun run typecheck` passes

---

### Task 3: Create Database Connection (`src/db/index.ts`)
**Time:** 30 min | **Dependencies:** Task 2

Implement database initialization:

1. Database location: `~/.config/pai-deps/pai-deps.db`
2. Create directory if not exists
3. Create lazy-initialized connection singleton
4. Enable foreign key constraints via pragma
5. Create tables on first access using raw SQL (avoid drizzle-kit migration complexity)
6. Export `getDb()`, `DB_PATH`, `DB_DIR`
7. Support `PAI_DEPS_DB` environment variable for test database path

Use `bun:sqlite` driver with `drizzle-orm/bun-sqlite` for native Bun support.

**Verification:** Database file created at expected location when `getDb()` called

---

### Task 4: Update Types (`src/types.ts`)
**Time:** 15 min | **Dependencies:** Task 2 | **Parallel:** Yes

Add or update types to match database schema:

1. Add `ContractType` type if not present
2. Ensure `Tool` interface matches tools table
3. Ensure `Dependency` interface matches dependencies table
4. Add `Contract` interface
5. Add `Verification` interface
6. Add `CircularDep` interface

Export inferred types from Drizzle schema where appropriate.

**Verification:** `bun run typecheck` passes

---

### Task 5: Create Migration Runner (`src/db/migrate.ts`)
**Time:** 20 min | **Dependencies:** Task 3 | **Parallel:** Yes

Create SQL migration to create all tables:

1. Use raw SQL CREATE TABLE IF NOT EXISTS statements
2. Include all indexes
3. Include foreign key definitions
4. Make migration idempotent (can run multiple times safely)

**Verification:** Running migration on fresh database creates all tables

---

### Task 6: Create Database Tests
**Time:** 45 min | **Dependencies:** Tasks 3, 4, 5

Create comprehensive tests in `tests/db.test.ts`:

1. Test database created on first access
2. Test directory created automatically
3. Test insert and retrieve tool
4. Test foreign key constraints enforced
5. Test cascade delete works
6. Test indexes exist
7. Test environment variable override for test database

Use temp directory for test database to avoid polluting user's config.

**Verification:** `bun test` passes all database tests

---

### Task 7: Integration Test
**Time:** 15 min | **Dependencies:** Task 6

Verify end-to-end:

1. Delete test database if exists
2. Call `getDb()` - should create database and tables
3. Insert sample tool
4. Insert dependency referencing tool
5. Insert contract referencing tool
6. Insert verification referencing contract
7. Verify all data persists and relationships work
8. Verify cascade delete: delete tool should delete deps, contracts, verifications

**Verification:** All integration tests pass

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Add Drizzle dependencies | 10m | F-001 |
| 2 | Create schema.ts | 30m | 1 |
| 3 | Create db/index.ts | 30m | 2 |
| 4 | Update types.ts | 15m | 2 |
| 5 | Create migrate.ts | 20m | 3 |
| 6 | Create tests | 45m | 3, 4, 5 |
| 7 | Integration test | 15m | 6 |

**Total:** ~165 minutes (~3 hours)

---

## Doctorow Gate Verification

After implementation, verify:

1. **Failure test:** What happens if ~/.config is read-only? (should error gracefully)
2. **Failure test:** What happens if disk is full? (should error gracefully)
3. **Assumption test:** Does it work with Bun's SQLite? (CI tests)
4. **Assumption test:** Are foreign keys enforced? (pragma check in tests)
5. **Rollback test:** Can we delete the DB and start fresh? (yes, no external state)
6. **Debt recorded:** Add entry to debt-ledger with score 3 (database adds maintenance)

---

## Completion Marker

When done, output:
```
[FEATURE COMPLETE]
Feature: F-002 - SQLite Database Schema with Drizzle
Tests: X passing
Files: src/db/schema.ts, src/db/index.ts, src/db/migrate.ts, tests/db.test.ts
Doctorow Gate: PASSED
```
