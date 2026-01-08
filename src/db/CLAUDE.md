# src/db/ - Database Layer

SQLite database with Drizzle ORM.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Database connection singleton, exports |
| `schema.ts` | Drizzle table definitions |
| `migrate.ts` | Schema migrations |

## Tables

### tools
Primary registry of all PAI tools.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier (e.g., "email") |
| name | TEXT | Human-readable name |
| path | TEXT | Filesystem path to tool |
| type | TEXT | cli \| mcp \| library \| workflow \| hook |
| version | TEXT | Semantic version (nullable) |
| reliability | REAL | 0.0-1.0 availability score |
| debtScore | INTEGER | Technical debt score |
| manifestPath | TEXT | Path to pai-manifest.yaml |
| stub | INTEGER | 1 if auto-created placeholder |
| lastVerified | TEXT | ISO timestamp |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

### dependencies
Edges in the dependency graph.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| consumerId | TEXT FK | Tool that has the dependency |
| providerId | TEXT FK | Tool being depended on |
| type | TEXT | cli \| mcp \| library \| database \| implicit |
| versionConstraint | TEXT | Semver constraint (nullable) |
| optional | INTEGER | 1 if optional dependency |
| createdAt | TEXT | ISO timestamp |

### contracts
Interface contracts for tools.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| toolId | TEXT FK | Tool this contract belongs to |
| contractType | TEXT | cli_output \| mcp_tool \| library_export \| db_schema |
| name | TEXT | Contract name (e.g., "email search --json") |
| schemaPath | TEXT | Path to JSON schema file |
| schemaHash | TEXT | SHA256 for drift detection |
| lastVerified | TEXT | ISO timestamp |
| status | TEXT | valid \| drift \| broken \| unknown |

### verifications
Verification history for contracts.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| contractId | INTEGER FK | Contract being verified |
| verifiedAt | TEXT | ISO timestamp |
| status | TEXT | pass \| fail \| drift |
| details | TEXT | JSON with error/diff info |
| gitCommit | TEXT | Git commit at verification time |

### circularDeps
Detected circular dependency cycles.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| cycle | TEXT | JSON array of tool IDs in cycle |
| detectedAt | TEXT | ISO timestamp |
| resolved | INTEGER | 1 if manually resolved |

## Usage

```typescript
import { getDb, closeDb, resetDb } from '../db/index.js';
import { tools, dependencies, contracts } from '../db/schema.js';

const db = getDb();

// Insert
db.insert(tools).values({ id: 'my-tool', ... }).run();

// Select all
const allTools = db.select().from(tools).all();

// Select with filter (use JS, not eq())
const tool = allTools.find(t => t.id === 'my-tool');
```

## CRITICAL: eq() Bug

**DO NOT USE** Drizzle's `eq()` operator for WHERE clauses:

```typescript
// BROKEN - returns undefined
import { eq } from 'drizzle-orm';
const tool = db.select().from(tools).where(eq(tools.id, 'x')).get();

// WORKS - use JavaScript filter
const allTools = db.select().from(tools).all();
const tool = allTools.find(t => t.id === 'x');
```

This is a known issue in this codebase. Raw bun:sqlite works, but drizzle-orm queries with eq() fail.

## Testing

Tests use environment variable `PAI_DEPS_DB` to point to a temp database:

```typescript
beforeEach(() => {
  resetDb();
  process.env['PAI_DEPS_DB'] = '/tmp/test.db';
});

afterEach(() => {
  closeDb();
  delete process.env['PAI_DEPS_DB'];
});
```
