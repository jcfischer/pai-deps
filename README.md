# pai-deps

Dependency management for PAI (Personal AI Infrastructure) tools. Track what uses what across your tool ecosystem.

Inspired by Cory Doctorow's principle: "Code is a liability, not an asset."

## Features

- **Registry**: Track all tools via `pai-manifest.yaml` declarations
- **Dependency Graph**: In-memory graph with forward/reverse queries
- **Auto-discovery**: Find and register all manifests across directories
- **Contract Verification**: Validate CLI and MCP tool schemas (coming soon)
- **Impact Analysis**: Calculate blast radius and chain reliability (coming soon)

## Installation

```bash
# Clone and build
git clone https://github.com/jfischburg/pai-deps.git
cd pai-deps
bun install
bun run build

# Or run directly
bun run src/index.ts
```

## Quick Start

```bash
# Initialize a manifest for your tool
pai-deps init ~/work/my-tool

# Register a tool
pai-deps register ~/work/my-tool

# List all registered tools
pai-deps list

# Show tool details
pai-deps show my-tool

# Query dependencies
pai-deps deps my-tool --recursive

# Discover all manifests in a directory tree
pai-deps discover ~/work

# Register all discovered manifests
pai-deps sync ~/work
```

## Manifest Format

Each tool declares its contracts in `pai-manifest.yaml`:

```yaml
name: email
version: 1.2.0
type: cli

provides:
  cli:
    - command: email search
    - command: email send
  mcp:
    - tool: email_search

depends_on:
  - name: resona
    type: library
  - name: nodemailer
    type: npm
    version: "^6.9.0"

reliability: 0.95
debt_score: 4
```

## Commands

| Command | Description |
|---------|-------------|
| `init <path>` | Generate pai-manifest.yaml from package.json |
| `register <path>` | Register a tool from its manifest |
| `unregister <tool>` | Remove a tool from the registry |
| `list` | List all registered tools |
| `show <tool>` | Show detailed tool information |
| `deps <tool>` | Query forward dependencies |
| `rdeps <tool>` | Query reverse dependencies (what depends on this) |
| `graph` | Generate DOT/SVG visualization of dependencies |
| `verify [tool]` | Verify CLI contracts against actual implementations |
| `drift [tool]` | Check for schema drift in contracts |
| `verify-output <tool> <contract>` | Validate output against JSON schema |
| `path <from> <to>` | Find shortest dependency path between tools |
| `allpaths <from> <to>` | Find all dependency paths between tools |
| `discover [roots...]` | Find all pai-manifest.yaml files |
| `sync [roots...]` | Discover and register all manifests |

### Global Options

- `--json` - Output as JSON for scripting
- `-q, --quiet` - Suppress non-essential output
- `-v, --verbose` - Verbose output with debug info

## Architecture

```
pai-deps/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── types.ts          # Type definitions
│   ├── db/               # SQLite + Drizzle ORM
│   │   ├── schema.ts     # Database schema
│   │   └── migrate.ts    # Migrations
│   ├── lib/
│   │   ├── manifest.ts   # YAML parsing + validation
│   │   ├── registry.ts   # Tool registration
│   │   ├── graph/        # Dependency graph algorithms
│   │   ├── discovery.ts  # Manifest discovery
│   │   └── analyzer.ts   # Source code analysis
│   └── commands/         # CLI command handlers
└── tests/                # 315 tests
```

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Run single test file
bun test tests/discovery.test.ts
```

## Roadmap

- [x] Core registry (register, list, show, unregister)
- [x] Forward dependency queries (deps)
- [x] Auto-discovery (discover, sync)
- [x] Manifest auto-generation (init --analyze)
- [x] Reverse dependencies (rdeps)
- [x] DOT graph generation
- [x] CLI contract verification
- [x] Path queries (path, allpaths)
- [x] Schema hashing and drift detection
- [ ] Chain reliability calculation
- [ ] Git pre-commit hooks
- [ ] CI integration

## License

MIT
