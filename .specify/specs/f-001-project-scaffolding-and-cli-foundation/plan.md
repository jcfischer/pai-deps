# Technical Plan: F-001 - Project Scaffolding and CLI Foundation

**Feature ID:** F-001
**Phase:** 1 (Core Registry)
**Estimated Hours:** 2

---

## Approach

Bootstrap a minimal CLI project using Bun + TypeScript + Commander.js. Focus on:
1. Correct project structure for future features
2. Global flags infrastructure that all commands will use
3. Build system producing standalone binary

---

## Technical Design

### Architecture

```
pai-deps/
├── src/
│   ├── index.ts          # CLI entry, Commander setup, global options
│   ├── types.ts          # GlobalOptions, OutputFormat types
│   ├── commands/         # Empty dir, commands added by later features
│   ├── lib/
│   │   └── output.ts     # JSON/table output helpers
│   └── db/               # Empty dir, database added by F-002
├── tests/
│   ├── cli.test.ts       # Basic CLI smoke tests
│   └── fixtures/         # Test fixtures
├── schemas/              # JSON schemas (manifest schema added by F-003)
├── package.json
├── tsconfig.json
└── .gitignore
```

### Key Components

#### 1. CLI Entry Point (`src/index.ts`)

```typescript
#!/usr/bin/env bun
import { program } from 'commander';
import { version } from '../package.json';

// Global options available to all commands
program
  .name('pai-deps')
  .description('PAI Dependency Tracker - Map and verify tool dependencies')
  .version(version)
  .option('--json', 'Output as JSON for scripting')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('-v, --verbose', 'Verbose output with debug info');

// Commands will be added here by other features:
// program.command('register')...
// program.command('list')...

program.parse();
```

#### 2. Type Definitions (`src/types.ts`)

```typescript
export interface GlobalOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

export type ToolType = 'cli' | 'mcp' | 'library' | 'workflow' | 'hook';
export type DependencyType = 'cli' | 'mcp' | 'library' | 'database' | 'implicit';
export type ContractStatus = 'valid' | 'drift' | 'broken' | 'unknown';
export type VerificationStatus = 'pass' | 'fail' | 'drift';

// Output formatting
export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

#### 3. Output Helpers (`src/lib/output.ts`)

```typescript
import type { GlobalOptions, CommandResult } from '../types';

export function output<T>(result: CommandResult<T>, opts: GlobalOptions): void {
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.success) {
    // Format human-readable output
    console.log(result.data);
  } else {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

export function log(message: string, opts: GlobalOptions): void {
  if (!opts.quiet) {
    console.log(message);
  }
}

export function debug(message: string, opts: GlobalOptions): void {
  if (opts.verbose) {
    console.log(`[DEBUG] ${message}`);
  }
}
```

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| commander | ^12.1.0 | CLI framework |
| typescript | ^5.7.0 | Type checking |
| @types/bun | latest | Bun type definitions |

### Build Configuration

**package.json:**
```json
{
  "name": "pai-deps",
  "version": "0.1.0",
  "description": "PAI Dependency Tracker",
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

**tsconfig.json:**
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

---

## Failure Mode Analysis

### How This Code Can Fail

| Failure Mode | Trigger | Detection | Degradation | Recovery |
|-------------|---------|-----------|-------------|----------|
| Commander parse error | Invalid CLI args | Commander throws | Show help | User fixes args |
| Missing Bun runtime | Run on Node.js | Import fails | Clear error message | Install Bun |
| Build fails | TypeScript errors | bun build exits non-zero | No binary | Fix types |

### Assumptions That Could Break

| Assumption | What Would Invalidate It | Detection Strategy |
|-----------|-------------------------|-------------------|
| Commander.js API stable | Major version bump | Package.json semver |
| Bun compile works | Bun breaking change | CI build step |
| ~/bin in PATH | User hasn't configured | Warn in link script |

### Blast Radius

- **Files touched:** 6 new files
- **Systems affected:** None (foundation only)
- **Rollback strategy:** Delete directory, no external state

---

## Implementation Steps

1. Create project directory structure
2. Initialize package.json with dependencies
3. Create tsconfig.json
4. Implement src/index.ts with Commander setup
5. Implement src/types.ts with shared types
6. Implement src/lib/output.ts with helpers
7. Create basic smoke tests
8. Build and verify binary
9. Link to ~/bin/pai-deps

---

## Testing Strategy

### Unit Tests

```typescript
// tests/cli.test.ts
import { describe, test, expect } from 'bun:test';
import { $ } from 'bun';

describe('pai-deps CLI', () => {
  test('--help shows usage', async () => {
    const result = await $`bun run src/index.ts --help`.text();
    expect(result).toContain('pai-deps');
    expect(result).toContain('--json');
  });

  test('--version shows version', async () => {
    const result = await $`bun run src/index.ts --version`.text();
    expect(result).toMatch(/\d+\.\d+\.\d+/);
  });

  test('unknown command shows error', async () => {
    const result = await $`bun run src/index.ts unknown 2>&1`.text();
    expect(result).toContain('error');
  });
});
```

### Integration Tests

- Build binary and run `./pai-deps --help`
- Verify binary runs without Bun installed (standalone)

---

## Doctorow Gate Checklist

- [ ] **Failure test:** What happens if Commander.js is missing? (graceful error)
- [ ] **Assumption test:** Does it work with Bun 1.0+? (CI matrix)
- [ ] **Rollback test:** Can the directory be deleted cleanly? (yes, no external state)
- [ ] **Debt recorded:** Score 2 (simple CLI, no external deps beyond commander)

---

## References

- App Context: `/Users/fischer/work/pai-deps/.specify/app-context.md`
- Spec: `/Users/fischer/work/pai-deps/.specify/specs/f-001-project-scaffolding-and-cli-foundation/spec.md`
