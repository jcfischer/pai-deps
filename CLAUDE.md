# pai-deps - AI Context

Dependency management for PAI (Personal AI Infrastructure) tools.

## Stack

- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript with strict mode
- **Database**: SQLite via Drizzle ORM
- **CLI**: Commander.js
- **Validation**: Zod schemas
- **Testing**: bun:test (301 tests)

## Key Conventions

### Output Format
- Human-readable by default
- `--json` flag for machine-readable output
- `--quiet` suppresses non-essential output
- `--verbose` enables debug logging
- Exit code 0 on success, 1 on error

### Database Access
**IMPORTANT**: Drizzle ORM's `eq()` operator has issues in this codebase. Queries with `.where(eq(field, value))` may return undefined.

**Workaround**: Fetch all records and use JavaScript `.filter()` / `.find()`:
```typescript
// DON'T DO THIS - unreliable
const tool = db.select().from(tools).where(eq(tools.id, toolId)).get();

// DO THIS INSTEAD
const allTools = db.select().from(tools).all();
const tool = allTools.find(t => t.id === toolId);
```

### Adding New Commands
1. Create `src/commands/<name>.ts`
2. Export `<name>Command(program: Command)` function
3. Import and register in `src/index.ts`
4. Add tests in `tests/<name>.test.ts`
5. Update README.md commands table

### Testing
- Tests use temporary directories and databases
- Always call `resetDb()` in `beforeEach`
- Always call `closeDb()` in `afterEach`
- Use non-null assertions (`[0]!`) for array access to satisfy strict TypeScript

## Architecture Overview

```
src/
├── index.ts          # CLI entry, command registration
├── types.ts          # Shared type definitions
├── db/               # Database layer (SQLite + Drizzle)
├── lib/              # Core business logic
│   ├── graph/        # Dependency graph algorithms
│   ├── manifest.ts   # YAML parsing
│   ├── verifier.ts   # CLI contract verification
│   ├── hasher.ts     # Schema hashing
│   └── dot.ts        # DOT graph generation
└── commands/         # CLI command handlers
```

## Current State (60% complete)

### Implemented
- Tool registry (register, unregister, list, show)
- Dependency graph (deps, rdeps, path, allpaths)
- Auto-discovery and sync
- Manifest generation (init --analyze)
- DOT/SVG graph visualization
- CLI contract verification
- Schema drift detection

### Pending
- MCP tool schema verification (F-016)
- Affected tool detection (F-017)
- Chain reliability calculation (F-011)
- Blast radius calculation (F-018)
- CI integration (F-022)

## Common Tasks

### Run tests
```bash
bun test
```

### Type check
```bash
bun run typecheck
```

### Build binary
```bash
bun run build
```

### Check feature progress
```bash
specflow status
```
