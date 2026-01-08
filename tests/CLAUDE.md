# tests/ - Test Suite

301 tests using bun:test framework.

## Running Tests

```bash
# Run all tests
bun test

# Run specific file
bun test tests/graph.test.ts

# Run with pattern
bun test --grep "circular"

# Watch mode
bun test --watch
```

## Test Pattern

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools } from '../src/db';

const TEST_DIR = join(tmpdir(), `pai-deps-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('Feature Name', () => {
  beforeEach(() => {
    // Reset database singleton
    resetDb();

    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Use test database
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
  });

  afterEach(() => {
    // Close database
    closeDb();

    // Clean up
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }

    delete process.env['PAI_DEPS_DB'];
  });

  test('does something', () => {
    const db = getDb();
    // ... test logic
    expect(result).toBe(expected);
  });
});
```

## Key Conventions

### Database Isolation
Each test file uses a unique temp directory with timestamp to avoid conflicts when running in parallel.

### Non-null Assertions
Use `[0]!` for array access to satisfy strict TypeScript:
```typescript
const items = db.select().from(tools).all();
expect(items[0]!.name).toBe('expected');
```

### Async Tests
Mark test functions as `async` when using promises:
```typescript
test('async operation', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

## Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `manifest.test.ts` | Manifest parsing, validation |
| `registry.test.ts` | Tool registration |
| `graph.test.ts` | Dependency graph operations |
| `discovery.test.ts` | Manifest auto-discovery |
| `analyzer.test.ts` | Source code analysis |
| `verify.test.ts` | CLI contract verification |
| `hasher.test.ts` | Schema hashing |
| `drift.test.ts` | Drift detection |
| `path.test.ts` | Path finding algorithms |
| `dot.test.ts` | DOT graph generation |

## Common Test Data

### Creating Test Tools
```typescript
const now = new Date().toISOString();
db.insert(tools).values({
  id: 'test-tool',
  name: 'Test Tool',
  type: 'cli',
  path: TEST_DIR,
  createdAt: now,
  updatedAt: now,
}).run();
```

### Creating Test Dependencies
```typescript
db.insert(dependencies).values({
  consumerId: 'tool-a',
  providerId: 'tool-b',
  type: 'library',
  createdAt: now,
}).run();
```

### Creating Test Manifests
```typescript
import { writeFileSync } from 'node:fs';
import { dump } from 'js-yaml';

const manifest = {
  name: 'test-tool',
  version: '1.0.0',
  type: 'cli',
  provides: { cli: [{ command: 'test run' }] },
};

writeFileSync(
  join(TEST_DIR, 'pai-manifest.yaml'),
  dump(manifest)
);
```
