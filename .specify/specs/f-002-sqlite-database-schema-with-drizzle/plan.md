# Technical Plan: F-002 - SQLite Database Schema with Drizzle

**Feature ID:** F-002
**Phase:** 1 (Core Registry)
**Estimated Hours:** 3

---

## Approach

Use Drizzle ORM with SQLite to define a type-safe database schema. Drizzle provides:
- Type-safe schema definitions in TypeScript
- Automatic migration generation
- Lightweight runtime (no query builder overhead for simple queries)

---

## Technical Design

### Architecture

```
src/db/
├── index.ts          # Database connection and initialization
├── schema.ts         # Drizzle schema definitions (all tables)
└── migrate.ts        # Migration runner (if needed)
```

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| drizzle-orm | ^0.29.0 | ORM for type-safe queries |
| better-sqlite3 | ^11.0.0 | SQLite driver (sync, fast) |
| drizzle-kit | ^0.20.0 | Migration generation (dev) |

### Schema Definition (`src/db/schema.ts`)

```typescript
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// Tools table
export const tools = sqliteTable('tools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  type: text('type').notNull(), // cli | mcp | library | workflow | hook
  version: text('version'),
  reliability: real('reliability').default(0.95),
  debtScore: integer('debt_score').default(0),
  manifestPath: text('manifest_path'),
  stub: integer('stub').default(0),
  lastVerified: text('last_verified'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  typeIdx: index('idx_tools_type').on(table.type),
  stubIdx: index('idx_tools_stub').on(table.stub),
}));

// Dependencies table
export const dependencies = sqliteTable('dependencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  consumerId: text('consumer_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // cli | mcp | library | database | implicit
  versionConstraint: text('version_constraint'),
  optional: integer('optional').default(0),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  consumerIdx: index('idx_deps_consumer').on(table.consumerId),
  providerIdx: index('idx_deps_provider').on(table.providerId),
}));

// Contracts table
export const contracts = sqliteTable('contracts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  toolId: text('tool_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  contractType: text('contract_type').notNull(), // cli_output | mcp_tool | library_export | db_schema
  name: text('name').notNull(),
  schemaPath: text('schema_path'),
  schemaHash: text('schema_hash'),
  lastVerified: text('last_verified'),
  status: text('status').default('unknown'), // valid | drift | broken | unknown
}, (table) => ({
  toolIdx: index('idx_contracts_tool').on(table.toolId),
}));

// Verifications table
export const verifications = sqliteTable('verifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contractId: integer('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  verifiedAt: text('verified_at').notNull(),
  status: text('status').notNull(), // pass | fail | drift
  details: text('details'), // JSON
  gitCommit: text('git_commit'),
}, (table) => ({
  contractIdx: index('idx_verifications_contract').on(table.contractId),
}));

// Circular dependencies table
export const circularDeps = sqliteTable('circular_deps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cycle: text('cycle').notNull(), // JSON array
  detectedAt: text('detected_at').notNull(),
  resolved: integer('resolved').default(0),
});
```

### Database Connection (`src/db/index.ts`)

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as schema from './schema';

const DB_DIR = join(homedir(), '.config', 'pai-deps');
const DB_PATH = join(DB_DIR, 'pai-deps.db');

let db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (db) return db;

  // Ensure directory exists
  if (!existsSync(DB_DIR)) {
    await mkdir(DB_DIR, { recursive: true });
  }

  // Create database connection
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });

  // Run migrations (create tables if they don't exist)
  await migrate(db);

  return db;
}

async function migrate(db: ReturnType<typeof drizzle>) {
  // Use Drizzle's push or manual SQL for initial schema
  // For simplicity, we'll use raw SQL to create tables if not exist
}

export { DB_PATH, DB_DIR };
```

### Alternative: Bun SQLite (Simpler)

Since we're using Bun, we can use `bun:sqlite` instead of better-sqlite3:

```typescript
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
```

This avoids native module compilation issues.

---

## Failure Mode Analysis

### How This Code Can Fail

| Failure Mode | Trigger | Detection | Degradation | Recovery |
|-------------|---------|-----------|-------------|----------|
| Directory creation fails | Permission denied | mkdir throws | Show clear error | User fixes permissions |
| Database locked | Concurrent access | SQLite error | Retry with backoff | Single process access |
| Schema mismatch | Version upgrade | Migration fails | Backup and recreate | Migration script |
| Disk full | Write fails | SQLite error | Clear error message | User frees space |

### Assumptions That Could Break

| Assumption | What Would Invalidate It | Detection Strategy |
|-----------|-------------------------|-------------------|
| ~/.config exists | Unusual system config | Check and create parent |
| SQLite works in Bun | Bun SQLite API changes | CI tests |
| Foreign keys enforced | SQLite version < 3.6.19 | Check pragma |

### Blast Radius

- **Files touched:** 3 new files (schema.ts, index.ts, tests)
- **Systems affected:** None external
- **Rollback strategy:** Delete database file, no external state

---

## Implementation Steps

1. Add Drizzle dependencies to package.json
2. Create `src/db/schema.ts` with all table definitions
3. Create `src/db/index.ts` with connection and initialization
4. Update `src/types.ts` to export inferred types from schema
5. Create tests for database operations
6. Verify foreign key constraints work
7. Test migration on fresh database

---

## Testing Strategy

### Unit Tests

```typescript
// tests/db.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getDb, DB_PATH } from '../src/db';
import { tools, dependencies } from '../src/db/schema';
import { unlinkSync, existsSync } from 'node:fs';

describe('Database', () => {
  beforeEach(() => {
    // Use test database
    process.env.PAI_DEPS_DB = '/tmp/pai-deps-test.db';
  });

  afterEach(() => {
    if (existsSync('/tmp/pai-deps-test.db')) {
      unlinkSync('/tmp/pai-deps-test.db');
    }
  });

  test('creates database on first access', async () => {
    const db = await getDb();
    expect(db).toBeDefined();
  });

  test('inserts and retrieves tool', async () => {
    const db = await getDb();
    await db.insert(tools).values({
      id: 'test-tool',
      name: 'Test Tool',
      path: '/test/path',
      type: 'cli',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await db.select().from(tools).where(eq(tools.id, 'test-tool'));
    expect(result[0].name).toBe('Test Tool');
  });

  test('enforces foreign key constraints', async () => {
    const db = await getDb();
    // Should fail: consumer_id doesn't exist
    expect(async () => {
      await db.insert(dependencies).values({
        consumerId: 'nonexistent',
        providerId: 'also-nonexistent',
        type: 'cli',
        createdAt: new Date().toISOString(),
      });
    }).toThrow();
  });
});
```

---

## Doctorow Gate Checklist

- [ ] **Failure test:** What happens if ~/.config is read-only? (graceful error)
- [ ] **Assumption test:** Does it work with Bun's SQLite? (CI tests)
- [ ] **Rollback test:** Can we delete the DB and start fresh? (yes)
- [ ] **Debt recorded:** Score 3 (database adds maintenance burden)

---

## References

- Spec: `/Users/fischer/work/pai-deps/.specify/specs/f-002-sqlite-database-schema-with-drizzle/spec.md`
- Drizzle SQLite: https://orm.drizzle.team/docs/get-started-sqlite
- Bun SQLite: https://bun.sh/docs/api/sqlite
