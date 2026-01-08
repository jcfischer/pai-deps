# pai-deps

Dependency management for PAI (Personal AI Infrastructure) tools. Track what uses what across your tool ecosystem.

> "Code is a liability, not an asset." — Cory Doctorow

## Features

- **Registry**: Track all tools via `pai-manifest.yaml` declarations
- **Dependency Graph**: In-memory graph with forward/reverse queries
- **Auto-discovery**: Find and register all manifests across directories
- **Contract Verification**: Validate CLI commands and MCP tool schemas
- **Schema Drift Detection**: Catch breaking changes before they ship
- **Impact Analysis**: Calculate blast radius and chain reliability
- **CI Integration**: Pre-commit hooks and CI commands
- **Health Dashboard**: ASCII visualization of ecosystem health

## Installation

```bash
# Clone and build
git clone https://github.com/jfischburg/pai-deps.git
cd pai-deps
bun install
bun run build

# Add to PATH
cp pai-deps ~/bin/
```

## Quick Start

```bash
# Initialize a manifest for your tool
pai-deps init ~/work/my-tool --analyze

# Register the tool
pai-deps register ~/work/my-tool

# Check what depends on it
pai-deps rdeps my-tool

# Verify contracts work
pai-deps verify my-tool

# See ecosystem health
pai-deps health
```

## Manifest Format

```yaml
# pai-manifest.yaml
name: email
version: 1.2.0
type: cli

provides:
  cli:
    - command: email search <query>
    - command: email send <to> [--subject]
  mcp:
    - tool: email_search
      schema: schemas/search.json

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

### Registry
| Command | Description |
|---------|-------------|
| `init <path>` | Generate manifest from source |
| `register <path>` | Register tool from manifest |
| `unregister <tool>` | Remove from registry |
| `list` | List all tools |
| `show <tool>` | Show tool details |

### Dependencies
| Command | Description |
|---------|-------------|
| `deps <tool>` | Forward dependencies |
| `rdeps <tool>` | Reverse dependencies |
| `path <from> <to>` | Shortest path |
| `allpaths <from> <to>` | All paths |
| `graph` | DOT/SVG visualization |

### Verification
| Command | Description |
|---------|-------------|
| `verify [tool]` | Verify CLI contracts |
| `drift [tool]` | Detect schema drift |
| `verify-output` | Validate runtime output |

### Analysis
| Command | Description |
|---------|-------------|
| `blast-radius <tool>` | Impact analysis |
| `chain-reliability` | Compound reliability |
| `affected <tool>` | Affected tools |
| `debt` | Technical debt report |
| `health` | ASCII dashboard |
| `report` | Markdown report |

### CI/CD
| Command | Description |
|---------|-------------|
| `ci check` | Full verification |
| `ci check --staged` | Only staged files |
| `ci affected` | Find affected tools |
| `hook install` | Install pre-commit hook |
| `hook status` | Check hook status |

### Global Options
- `--json` — Machine-readable output
- `-q, --quiet` — Suppress output
- `-v, --verbose` — Debug info

## Pre-commit Hook

```bash
# Install hook
pai-deps hook install

# With quick mode for faster commits
pai-deps hook install --quick

# Check status
pai-deps hook status
```

The hook runs `pai-deps ci check --staged` before each commit, blocking if contracts are broken.

## CI Integration

```yaml
# GitHub Actions example
- name: Check dependencies
  run: |
    pai-deps sync .
    pai-deps ci check
```

## Documentation

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for comprehensive usage guide.

## Development

```bash
# Run tests (387 tests)
bun test

# Type check
bun run typecheck

# Build binary
bun run build
```

## Architecture

```
pai-deps/
├── src/
│   ├── index.ts          # CLI entry
│   ├── db/               # SQLite + Drizzle
│   ├── lib/              # Core logic
│   │   ├── graph/        # Dependency algorithms
│   │   ├── hook/         # Git hook management
│   │   ├── ci/           # CI commands
│   │   └── ...
│   └── commands/         # CLI handlers
├── tests/                # 387 tests
└── docs/                 # Documentation
```

## Status

All 26 features complete. See [.specify/](.specify/) for specifications.

## License

MIT
