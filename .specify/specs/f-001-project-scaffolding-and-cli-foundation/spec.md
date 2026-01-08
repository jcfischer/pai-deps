# Feature Specification: F-001 - Project Scaffolding and CLI Foundation

**Feature ID:** F-001
**Phase:** 1 (Core Registry)
**Priority:** 1
**Estimated Hours:** 2
**Reliability Target:** 0.98

---

## Summary

Create the pai-deps project with Bun, TypeScript, and Commander.js. Set up package.json, tsconfig.json, directory structure (src/commands, src/lib, src/db). Implement global flags (--json, --quiet, --verbose) and help system.

---

## Problem Statement

PAI needs a dependency tracking CLI tool. Before any functionality can be implemented, we need a solid foundation with:
- Project structure following PAI conventions
- CLI framework with global flags for consistent scripting
- Build system that produces a standalone binary

---

## Requirements

### Functional Requirements

1. **CLI Entry Point**
   - Running `pai-deps --help` shows available commands and global flags
   - Running `pai-deps --version` shows version from package.json
   - Unknown commands show helpful error message

2. **Global Flags**
   - `--json` - Output as JSON for scripting (parsed by all commands)
   - `--quiet` / `-q` - Suppress non-essential output
   - `--verbose` / `-v` - Verbose output with debug information
   - `--help` / `-h` - Show help for command or global help

3. **Directory Structure**
   ```
   pai-deps/
   ├── src/
   │   ├── index.ts          # CLI entry point
   │   ├── types.ts          # Shared type definitions
   │   ├── commands/         # Command implementations
   │   ├── lib/              # Shared utilities
   │   └── db/               # Database schema and connection
   ├── tests/
   ├── schemas/              # JSON schemas for validation
   ├── package.json
   └── tsconfig.json
   ```

4. **Build System**
   - `bun build --compile` produces standalone binary
   - Binary can be symlinked to `~/bin/pai-deps`
   - `bun test` runs test suite
   - `bun run typecheck` runs TypeScript check

### Non-Functional Requirements

1. **Stack Compliance**
   - TypeScript with strict mode
   - Bun runtime (not Node.js)
   - Commander.js for CLI parsing

2. **Code Quality**
   - No npm/yarn/pnpm - use Bun
   - Consistent code style (implicit from PAI conventions)
   - Type-safe with no `any` types

---

## Acceptance Criteria

- [ ] Running `pai-deps --help` shows available commands
- [ ] Global `--json` flag is parsed and available to all commands
- [ ] Project builds successfully with `bun build --compile`
- [ ] Binary can be linked to `~/bin/pai-deps`
- [ ] `bun test` passes with basic smoke tests
- [ ] `bun run typecheck` passes with no errors

---

## System Context

### Upstream Dependencies

| System | What We Get | What Breaks If It Changes |
|--------|-------------|---------------------------|
| Bun | Runtime, build system | Everything |
| Commander.js | CLI parsing | Command handling |

### Downstream Consumers

| System | What They Expect | Breaking Change Threshold |
|--------|-----------------|--------------------------|
| F-002 (Database) | Working CLI foundation | Any breaking change to global flags |
| F-003 (Manifest) | Working CLI foundation | Any breaking change to project structure |
| All other features | Global flags, types, project structure | Breaking changes to shared types |

### Adjacent Systems

| System | Implicit Dependency | Risk |
|--------|---------------------|------|
| ~/bin/ | Symlink location | Low |
| PAI conventions | Code style, structure | Low |

---

## Out of Scope

- Database setup (F-002)
- Manifest parsing (F-003)
- Any actual commands (later features)
- MCP server mode

---

## Technical Notes

### Commander.js Setup

```typescript
import { program } from 'commander';

program
  .name('pai-deps')
  .description('PAI Dependency Tracker')
  .version('0.1.0')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('-v, --verbose', 'Verbose output');

// Commands added by other features
```

### Global Options Type

```typescript
export interface GlobalOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}
```

### Package.json

```json
{
  "name": "pai-deps",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "pai-deps": "./src/index.ts"
  },
  "scripts": {
    "start": "bun run src/index.ts",
    "build": "bun build --compile --outfile=pai-deps src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## References

- App Context: `/Users/fischer/work/pai-deps/.specify/app-context.md`
- Design Document: `/Users/fischer/work/kai-improvement-roadmap/design-pai-dependency-tracker.md`
