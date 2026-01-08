# Implementation Tasks: F-001 - Project Scaffolding and CLI Foundation

**Feature ID:** F-001
**Total Estimated Time:** 2 hours
**Parallelizable:** Tasks 1-3 sequential, then 4-6 parallel, then 7-9 sequential

---

## Task List

### Task 1: Initialize Project Structure
**Time:** 10 min | **Dependencies:** None

Create directory structure:
```bash
mkdir -p src/{commands,lib,db} tests/fixtures schemas
```

Create `.gitignore`:
```
node_modules/
*.db
*.db-shm
*.db-wal
pai-deps
.DS_Store
```

**Verification:** `ls -la src/` shows commands, lib, db directories

---

### Task 2: Create package.json
**Time:** 10 min | **Dependencies:** Task 1

```json
{
  "name": "pai-deps",
  "version": "0.1.0",
  "description": "PAI Dependency Tracker - Map and verify tool dependencies",
  "type": "module",
  "main": "src/index.ts",
  "bin": {
    "pai-deps": "./src/index.ts"
  },
  "scripts": {
    "start": "bun run src/index.ts",
    "build": "bun build --compile --outfile=pai-deps src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "link": "ln -sf $(pwd)/pai-deps ~/bin/pai-deps"
  },
  "dependencies": {
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

**Verification:** `bun install` succeeds

---

### Task 3: Create tsconfig.json
**Time:** 5 min | **Dependencies:** Task 2

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

**Verification:** `bun run typecheck` runs (may fail until src files exist)

---

### Task 4: Implement src/types.ts
**Time:** 15 min | **Dependencies:** Task 3 | **Parallel:** Yes

Define shared types for the entire CLI:

```typescript
// Tool types
export type ToolType = 'cli' | 'mcp' | 'library' | 'workflow' | 'hook';
export type DependencyType = 'cli' | 'mcp' | 'library' | 'database' | 'implicit';
export type ContractType = 'cli_output' | 'mcp_tool' | 'library_export' | 'db_schema';
export type ContractStatus = 'valid' | 'drift' | 'broken' | 'unknown';
export type VerificationStatus = 'pass' | 'fail' | 'drift';

// CLI types
export interface GlobalOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

// Output types
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Tool schema (preview for F-002)
export interface Tool {
  id: string;
  name: string;
  path: string;
  type: ToolType;
  version?: string;
  reliability: number;
  debtScore: number;
  stub: boolean;
}

// Dependency schema (preview for F-002)
export interface Dependency {
  consumerId: string;
  providerId: string;
  type: DependencyType;
  versionConstraint?: string;
  optional: boolean;
}
```

**Verification:** `bun run typecheck` passes for types.ts

---

### Task 5: Implement src/lib/output.ts
**Time:** 15 min | **Dependencies:** Task 4 | **Parallel:** Yes

```typescript
import type { GlobalOptions, CommandResult } from '../types';

/**
 * Output command result in JSON or human-readable format
 */
export function output<T>(result: CommandResult<T>, opts: GlobalOptions): void {
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  // Human-readable output depends on data type
  if (typeof result.data === 'string') {
    console.log(result.data);
  } else if (result.data !== undefined) {
    console.log(result.data);
  }
}

/**
 * Log message unless quiet mode
 */
export function log(message: string, opts: GlobalOptions): void {
  if (!opts.quiet) {
    console.log(message);
  }
}

/**
 * Log debug message in verbose mode
 */
export function debug(message: string, opts: GlobalOptions): void {
  if (opts.verbose) {
    console.log(`[DEBUG] ${message}`);
  }
}

/**
 * Log warning message
 */
export function warn(message: string, opts: GlobalOptions): void {
  if (!opts.quiet) {
    console.warn(`WARNING: ${message}`);
  }
}

/**
 * Format data as ASCII table (placeholder for future enhancement)
 */
export function table(headers: string[], rows: string[][]): string {
  // Simple implementation - can be enhanced later
  const lines: string[] = [];
  lines.push(headers.join('\t'));
  lines.push(headers.map(() => '---').join('\t'));
  for (const row of rows) {
    lines.push(row.join('\t'));
  }
  return lines.join('\n');
}
```

**Verification:** Import works in index.ts

---

### Task 6: Implement src/index.ts
**Time:** 20 min | **Dependencies:** Tasks 4, 5 | **Parallel:** No

```typescript
#!/usr/bin/env bun
import { program } from 'commander';
import type { GlobalOptions } from './types';
import { log, debug } from './lib/output';

// Read version from package.json
const pkg = await Bun.file('./package.json').json();

program
  .name('pai-deps')
  .description('PAI Dependency Tracker - Map and verify tool dependencies')
  .version(pkg.version)
  .option('--json', 'Output as JSON for scripting')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('-v, --verbose', 'Verbose output with debug info');

// Helper to get global options from any command
export function getGlobalOptions(): GlobalOptions {
  return program.opts();
}

// Placeholder command (remove after adding real commands)
program
  .command('ping')
  .description('Test that CLI is working')
  .action(() => {
    const opts = getGlobalOptions();
    debug('Running ping command', opts);
    if (opts.json) {
      console.log(JSON.stringify({ success: true, message: 'pong' }));
    } else {
      log('pong', opts);
    }
  });

// Parse CLI arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
```

**Verification:** `bun run src/index.ts --help` shows help

---

### Task 7: Create Basic Tests
**Time:** 20 min | **Dependencies:** Task 6

```typescript
// tests/cli.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';
import { $ } from 'bun';

describe('pai-deps CLI', () => {
  test('--help shows usage and commands', async () => {
    const result = await $`bun run src/index.ts --help`.text();
    expect(result).toContain('pai-deps');
    expect(result).toContain('--json');
    expect(result).toContain('--quiet');
    expect(result).toContain('--verbose');
  });

  test('--version shows semver version', async () => {
    const result = await $`bun run src/index.ts --version`.text();
    expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('ping command returns pong', async () => {
    const result = await $`bun run src/index.ts ping`.text();
    expect(result.trim()).toBe('pong');
  });

  test('ping --json returns JSON', async () => {
    const result = await $`bun run src/index.ts ping --json`.text();
    const json = JSON.parse(result);
    expect(json.success).toBe(true);
    expect(json.message).toBe('pong');
  });

  test('unknown command shows error', async () => {
    const proc = Bun.spawn(['bun', 'run', 'src/index.ts', 'unknown'], {
      stderr: 'pipe',
    });
    const stderr = await new Response(proc.stderr).text();
    expect(stderr).toContain('error');
  });
});
```

**Verification:** `bun test` passes all tests

---

### Task 8: Build and Verify Binary
**Time:** 10 min | **Dependencies:** Task 7

```bash
# Build standalone binary
bun build --compile --outfile=pai-deps src/index.ts

# Verify it runs
./pai-deps --help
./pai-deps --version
./pai-deps ping --json

# Check binary size (should be ~50-80MB typical for Bun compile)
ls -lh pai-deps
```

**Verification:** Binary runs standalone, shows correct version

---

### Task 9: Link to ~/bin
**Time:** 5 min | **Dependencies:** Task 8

```bash
# Create symlink
ln -sf $(pwd)/pai-deps ~/bin/pai-deps

# Verify it's in PATH
which pai-deps
pai-deps --version
```

**Verification:** `pai-deps --help` works from any directory

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Initialize project structure | 10m | None |
| 2 | Create package.json | 10m | 1 |
| 3 | Create tsconfig.json | 5m | 2 |
| 4 | Implement types.ts | 15m | 3 |
| 5 | Implement output.ts | 15m | 3 |
| 6 | Implement index.ts | 20m | 4, 5 |
| 7 | Create tests | 20m | 6 |
| 8 | Build binary | 10m | 7 |
| 9 | Link to ~/bin | 5m | 8 |

**Total:** ~110 minutes (~2 hours)

---

## Doctorow Gate Verification

After implementation, verify:

1. **Failure test:** Remove commander from node_modules, run CLI - should error gracefully
2. **Assumption test:** Run `bun test` to verify all assumptions hold
3. **Rollback test:** The feature adds no external state, can be deleted cleanly
4. **Debt recorded:** Add entry to debt-ledger with score 2

---

## Completion Marker

When done, output:
```
[FEATURE COMPLETE]
Feature: F-001 - Project scaffolding and CLI foundation
Tests: X passing
Files: package.json, tsconfig.json, src/index.ts, src/types.ts, src/lib/output.ts, tests/cli.test.ts
Doctorow Gate: PASSED
```
