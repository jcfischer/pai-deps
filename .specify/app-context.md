# PAI Dependency Tracker - Application Context

**Project:** pai-deps
**Type:** CLI Tool
**Status:** Specification Complete
**Created:** 2026-01-07
**Source:** Design document at `/Users/fischer/work/kai-improvement-roadmap/design-pai-dependency-tracker.md`

---

## Executive Summary

`pai-deps` is a dependency tracking system for the Personal AI Infrastructure (PAI) ecosystem. It maps tool interdependencies, detects breaking changes in CLI/API contracts, calculates compound reliability across chains, and integrates with SpecKit for impact analysis during feature development.

### Core Problem

PAI has grown to 40+ interconnected tools with hidden dependencies:
- **daily-briefing** depends on 5 components (ical, supertag, email, ragent, resona) with **77.4% compound reliability**
- **meeting-intelligence** depends on 4 components (ical, supertag, email, pii) with **81.5% compound reliability**
- Breaking changes propagate silently through CLI `--json` output schemas
- No mechanism to answer "what breaks if X changes"

These two chains (`daily-briefing` and `meeting-intelligence`) are the highest-pain dependency chains in PAI.

### Solution

A lightweight, TypeScript-native dependency tracker with:
- SQLite-backed registry of tools and their contracts
- Graph queries (deps, rdeps, affected, path)
- Contract verification with schema drift detection
- Chain reliability calculation
- SpecKit integration for impact analysis

---

## Core Principle

**Doctorow Principle:** "Code is a liability, not an asset. Probabilities are multiplicative."

Chain reliability = product of individual reliabilities:
```
0.95 x 0.95 x 0.95 x 0.95 x 0.95 = 77.4% chain reliability
```

---

## Stakeholders

| Role | Needs | Priority |
|------|-------|----------|
| Developer (Daniel) | Know blast radius before making changes | High |
| Claude Code | Query dependencies via CLI `--json` for planning | High |
| CI/CD | Verify contracts on commit, detect affected tools | Medium |
| SpecKit | Auto-populate system context and failure modes | Medium |

---

## Confirmed Requirements

These requirements were confirmed during the specification interview:

| Requirement | Decision |
|-------------|----------|
| **Storage** | Single global SQLite database at `~/.config/pai-deps/pai-deps.db` |
| **Missing dependencies** | Create stub entry automatically with warning (allows incremental adoption) |
| **CLI namespace** | `pai-deps <command>` |
| **JSON output** | `--json` flag on ALL commands for consistent scripting |
| **Output style** | ASCII tables for health/report commands (no TUI for MVP) |
| **SpecKit integration** | Standalone command that SpecKit can call |
| **Circular dependencies** | Warn but allow - register but flag as architectural debt |
| **Scope** | All 6 phases - full implementation including integrations and automation |

---

## Technical Context

### Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Database:** SQLite + Drizzle ORM
- **CLI Framework:** Commander.js
- **Validation:** Zod
- **Graph:** Custom adjacency list implementation
- **Visualization:** SVG generation (graphviz-compatible DOT output)

### Storage

- **Database:** `~/.config/pai-deps/pai-deps.db` (single global instance)
- **Cache:** `~/.cache/pai-deps/` (generated graphs, verification results)
- **Config:** `~/.config/pai-deps/config.json` (optional settings)

### Related Systems

| System | Integration Type | Purpose |
|--------|-----------------|---------|
| SpecKit | CLI invocation | Impact analysis during SPECIFY/PLAN phases |
| Git | Pre-commit hook | Verify contracts before commit |
| GitHub Actions | CI workflow | Affected detection, contract verification |
| Claude Code | CLI + `--json` | Query dependencies during development |

---

## Data Model

### Tools Table
```typescript
export const tools = sqliteTable('tools', {
  id: text('id').primaryKey(),           // e.g., "email"
  name: text('name').notNull(),
  path: text('path').notNull(),          // ~/work/DA/KAI/skills/email
  type: text('type').notNull(),          // cli | mcp | library | workflow | hook
  version: text('version'),
  reliability: real('reliability'),       // 0.0-1.0
  debt_score: integer('debt_score'),
  manifest_path: text('manifest_path'),
  stub: integer('stub').default(0),      // 1 if auto-created stub
  last_verified: text('last_verified'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

### Dependencies Table
```typescript
export const dependencies = sqliteTable('dependencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  consumer_id: text('consumer_id').notNull().references(() => tools.id),
  provider_id: text('provider_id').notNull().references(() => tools.id),
  type: text('type').notNull(),          // cli | mcp | library | database | implicit
  version_constraint: text('version_constraint'),
  optional: integer('optional').default(0),
  created_at: text('created_at').notNull(),
});
```

### Contracts Table
```typescript
export const contracts = sqliteTable('contracts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tool_id: text('tool_id').notNull().references(() => tools.id),
  contract_type: text('contract_type').notNull(), // cli_output | mcp_tool | library_export | db_schema
  name: text('name').notNull(),                   // e.g., "email search --json"
  schema_path: text('schema_path'),
  schema_hash: text('schema_hash'),
  last_verified: text('last_verified'),
  status: text('status').default('unknown'),     // valid | drift | broken
});
```

### Verifications Table
```typescript
export const verifications = sqliteTable('verifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contract_id: integer('contract_id').notNull().references(() => contracts.id),
  verified_at: text('verified_at').notNull(),
  status: text('status').notNull(),              // pass | fail | drift
  details: text('details'),
  git_commit: text('git_commit'),
});
```

### Circular Dependencies Table
```typescript
export const circularDeps = sqliteTable('circular_deps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cycle: text('cycle').notNull(),               // JSON array of tool IDs in cycle
  detected_at: text('detected_at').notNull(),
  resolved: integer('resolved').default(0),
});
```

---

## Manifest Specification (pai-manifest.yaml)

```yaml
name: example-cli
version: 1.0.0
type: cli  # cli | mcp | library | workflow | hook

provides:
  cli:
    - command: example list
      output_schema: ./schemas/list-output.json
    - command: example show
      output_schema: ./schemas/show-output.json
  mcp:
    - tool: example_search
      schema: ./schemas/search-tool.json
  library:
    - export: ExampleService
      module: ./src/index.ts
  database:
    - path: ~/.config/example/data.db
      schema: ./src/db/schema.ts

depends_on:
  - name: other-tool
    type: cli  # cli | mcp | library | database | npm
    commands: ["other-tool search"]  # for cli type
    version: ">=1.0.0"               # optional version constraint
    optional: false                   # default false

reliability: 0.95  # estimated availability (0.0-1.0)
debt_score: 4      # from SpecKit debt-ledger (1-20+)
```

---

## CLI Commands

### Global Flags (ALL commands)
- `--json` - Output as JSON for scripting
- `--quiet` / `-q` - Suppress non-essential output
- `--verbose` / `-v` - Verbose output
- `--help` / `-h` - Show help

### Tool Management
- `pai-deps register <path>` - Register tool from pai-manifest.yaml
- `pai-deps unregister <tool>` - Remove tool from registry
- `pai-deps list` - List all registered tools
- `pai-deps show <tool>` - Show tool details
- `pai-deps init <path>` - Generate pai-manifest.yaml template

### Dependency Queries
- `pai-deps deps <tool>` - Forward dependencies
- `pai-deps rdeps <tool>` - Reverse dependencies (who depends on me)
- `pai-deps path <from> <to>` - Shortest dependency path
- `pai-deps allpaths <from> <to>` - All paths between tools

### Impact Analysis
- `pai-deps affected <tool>` - Tools affected by changes
- `pai-deps blast-radius <tool>` - Detailed impact analysis
- `pai-deps reliability <tool>` - Calculate compound reliability

### Contract Verification
- `pai-deps verify <tool>` - Verify tool's contracts
- `pai-deps verify --all` - Verify all contracts
- `pai-deps drift <tool>` - Check for schema drift

### Reporting
- `pai-deps graph` - Generate dependency graph (SVG)
- `pai-deps graph <tool>` - Generate subgraph for specific tool
- `pai-deps report` - Generate full dependency report
- `pai-deps debt` - Show debt scores across ecosystem
- `pai-deps health` - System health summary (ASCII table)

### CI Integration
- `pai-deps ci check` - Pre-commit contract check
- `pai-deps ci affected --base <branch>` - Affected tools since branch

### SpecKit Integration
- `pai-deps speckit context <tool>` - System context for SPECIFY phase
- `pai-deps speckit failures <tool>` - Failure modes for PLAN phase

---

## Example Usage

```bash
# What depends on email CLI?
pai-deps rdeps email
# Output: daily-briefing, meeting-intelligence, reply-email, reporting

# What does daily-briefing depend on?
pai-deps deps daily-briefing
# Output: email, ical, supertag, ragent, resona (transitive)

# Calculate chain reliability
pai-deps reliability daily-briefing
# Output: 77.4% (5 components in longest path) [WARNING]

# What needs retesting if resona changes?
pai-deps affected resona
# Output: supertag-cli, email, ragent, daily-briefing, meeting-intelligence

# JSON output for Claude Code
pai-deps rdeps email --json
# Output: {"tool":"email","reverse_deps":["daily-briefing","meeting-intelligence",...]}
```

---

## Graph Data Structure

```typescript
interface DependencyGraph {
  nodes: Map<string, ToolNode>;
  edges: Edge[];
}

interface ToolNode {
  id: string;
  name: string;
  type: 'cli' | 'mcp' | 'library' | 'workflow' | 'hook';
  reliability: number;
  debtScore: number;
  stub: boolean;
  contracts: Contract[];
}

interface Edge {
  from: string;      // consumer
  to: string;        // provider
  type: 'cli' | 'mcp' | 'library' | 'database' | 'implicit';
  weight: number;    // 1 / provider.reliability (for path calculations)
}
```

---

## Circular Dependency Handling

When circular dependencies are detected:
1. **Warn** - emit warning to stderr
2. **Allow** - register both tools and the dependency
3. **Flag** - record in `circular_deps` table as architectural debt
4. **Prevent infinite loops** - use visited set during graph traversal

Example warning:
```
WARNING: Circular dependency detected: A -> B -> C -> A
This has been flagged as architectural debt.
```

---

## Stub Entry Handling

When a dependency references an unregistered tool:
1. **Auto-create stub** - insert tool with `stub: true`
2. **Warn** - emit warning about missing manifest
3. **Allow registration** - don't block on missing dependencies

Example warning:
```
WARNING: Tool 'unregistered-tool' not found. Creating stub entry.
Run 'pai-deps register <path>' to register it properly.
```

---

## File Structure

```
pai-deps/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── types.ts              # Type definitions
│   ├── db/
│   │   ├── index.ts          # Database connection
│   │   └── schema.ts         # Drizzle schema
│   ├── lib/
│   │   ├── graph.ts          # Graph data structure + algorithms
│   │   ├── manifest.ts       # Manifest parser + validator
│   │   ├── verifier.ts       # Contract verification
│   │   └── output.ts         # ASCII table + JSON formatters
│   └── commands/
│       ├── register.ts
│       ├── unregister.ts
│       ├── list.ts
│       ├── show.ts
│       ├── init.ts
│       ├── deps.ts
│       ├── rdeps.ts
│       ├── path.ts
│       ├── allpaths.ts
│       ├── affected.ts
│       ├── blast-radius.ts
│       ├── reliability.ts
│       ├── verify.ts
│       ├── drift.ts
│       ├── graph.ts
│       ├── report.ts
│       ├── debt.ts
│       ├── health.ts
│       ├── ci-check.ts
│       ├── ci-affected.ts
│       ├── speckit-context.ts
│       └── speckit-failures.ts
├── schemas/
│   └── manifest.json         # JSON Schema for pai-manifest.yaml
├── tests/
│   └── ...
├── package.json
└── tsconfig.json
```

---

## Integration Points

### SpecKit Integration

`pai-deps` provides standalone commands that SpecKit can call:

```bash
# Called during SPECIFY phase
pai-deps speckit context <tool> --json
# Returns: { upstream: [...], downstream: [...], reliability: 0.77, blast_radius: 5 }

# Called during PLAN phase
pai-deps speckit failures <tool> --json
# Returns: [{ mode: "email unavailable", detection: "...", recovery: "..." }]
```

### Git Hook Integration

```bash
# .git/hooks/pre-commit
pai-deps verify --staged --json
```

### CI Integration (GitHub Actions)

```yaml
- run: pai-deps ci affected --base origin/main --json > affected.json
- run: pai-deps verify $(cat affected.json | jq -r '.[]')
```

### Claude Code Integration

Claude Code queries via CLI with `--json`:
```bash
pai-deps rdeps email --json
pai-deps affected resona --json
pai-deps reliability daily-briefing --json
```

---

## Implementation Phases

### Phase 1: Core Registry (Week 1)
- CLI scaffolding with Commander.js
- SQLite schema with Drizzle
- `register`, `unregister`, `list`, `show`, `init` commands
- pai-manifest.yaml specification
- Bootstrap with 10 core tool manifests

### Phase 2: Dependency Graph (Week 2)
- Graph data structure implementation
- `deps`, `rdeps` queries
- `path`, `allpaths` queries
- `reliability` calculation
- `graph` command with SVG output

### Phase 3: Contract Verification (Week 3)
- CLI output schema verification
- MCP tool schema verification
- Schema hashing for drift detection
- `verify` and `drift` commands
- JSON Schema generation helpers

### Phase 4: Impact Analysis (Week 4)
- `affected` detection
- `blast-radius` calculation
- Debt score aggregation
- `health` dashboard (ASCII)
- Impact reports

### Phase 5: Integrations (Week 5)
- SpecKit hook integration (`speckit context`, `speckit failures`)
- Git pre-commit hook
- GitHub Actions workflow
- CI commands (`ci check`, `ci affected`)

### Phase 6: Automation (Week 6)
- Auto-discovery of pai-manifest.yaml files
- Auto-generation of manifests from package.json + analysis
- Scheduled verification runs
- Alert notifications (optional)

---

## Success Criteria

1. **Visibility:** Answer "what breaks if X changes" in < 5 seconds
2. **Prevention:** Catch breaking schema changes before commit
3. **Quantification:** Track compound reliability < 80% warnings
4. **Integration:** Seamless SpecKit workflow integration
5. **Adoption:** Incremental - works with partial manifests (stub entries)

---

## Constraints

1. **No TUI for MVP:** ASCII tables only, no blessed/ink
2. **SQLite only:** No external database dependencies
3. **CLI-first:** All operations via CLI, no daemon
4. **Bun runtime:** Not compatible with Node.js
5. **Single database:** Global `~/.config/pai-deps/pai-deps.db`

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Manifest maintenance burden | High | Medium | Auto-discovery in Phase 6 |
| Schema drift false positives | Medium | Low | Hash comparison + manual review |
| Graph cycles cause hangs | Low | High | Cycle detection + max depth limits |
| Performance with 100+ tools | Low | Medium | Indexes + lazy loading |

---

## References

- Design Document: `/Users/fischer/work/kai-improvement-roadmap/design-pai-dependency-tracker.md`
- Nx Dependency Graph: https://nx.dev/nx-api/nx/documents/dep-graph
- Bazel Query Language: https://bazel.build/query/language
- SpecKit: `~/.claude/skills/SpecKit/`
