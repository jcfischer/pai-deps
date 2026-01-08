# pai-deps Development Guide

Comprehensive guide for using pai-deps to manage dependencies and contracts in your tool ecosystem.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Core Concepts](#core-concepts)
3. [Getting Started](#getting-started)
4. [The Manifest File](#the-manifest-file)
5. [Development Workflow](#development-workflow)
6. [Command Reference](#command-reference)
7. [CI/CD Integration](#cicd-integration)
8. [Pre-commit Hooks](#pre-commit-hooks)
9. [Visualization](#visualization)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Philosophy

pai-deps is built on the principle that **code is a liability, not an asset**. Every tool you create adds maintenance burden. pai-deps helps you:

- **Track contracts**: Know exactly what each tool provides (CLI commands, MCP tools)
- **Understand impact**: Before changing a tool, know what depends on it
- **Verify stability**: Ensure contracts don't break silently
- **Measure health**: Quantify technical debt and reliability across your ecosystem

---

## Core Concepts

### Tools

A **tool** is any software component with a manifest. Tools can be:
- CLI applications
- MCP servers
- Libraries
- Services

### Manifests

Every tool declares its contracts in a `pai-manifest.yaml` file:
- What it **provides** (CLI commands, MCP tools, APIs)
- What it **depends on** (other tools, npm packages)
- Quality metrics (reliability score, debt score)

### Dependency Graph

pai-deps builds an in-memory graph of all tool relationships:
- **Forward dependencies**: What does this tool need?
- **Reverse dependencies**: What needs this tool?
- **Transitive dependencies**: The full chain of dependencies

### Contracts

Contracts are promises a tool makes:
- CLI commands with specific arguments
- MCP tools with defined input/output schemas
- Schemas that define expected data structures

### Drift Detection

When a tool's actual behavior diverges from its declared contract, that's **drift**. pai-deps detects:
- Missing CLI commands
- Changed output schemas
- Broken MCP tool definitions

---

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/jfischburg/pai-deps.git
cd pai-deps

# Install dependencies
bun install

# Build the binary
bun run build

# Add to PATH (optional)
cp pai-deps ~/bin/
```

### First Steps

```bash
# 1. Initialize a manifest for your tool
pai-deps init ~/work/my-tool

# 2. Review and edit the generated manifest
cat ~/work/my-tool/pai-manifest.yaml

# 3. Register the tool
pai-deps register ~/work/my-tool

# 4. Verify it's registered
pai-deps list
```

### Bulk Registration

For existing projects with many tools:

```bash
# Discover all manifests in a directory tree
pai-deps discover ~/work

# Register all discovered manifests
pai-deps sync ~/work

# Or do both in one step
pai-deps sync ~/work --recursive
```

---

## The Manifest File

### Basic Structure

```yaml
# pai-manifest.yaml
name: my-tool
version: 1.0.0
type: cli  # cli | mcp | library | service

# What this tool provides
provides:
  cli:
    - command: my-tool run <file>
    - command: my-tool validate [options]
  mcp:
    - tool: my_tool_action
      schema: schemas/action.json

# What this tool needs
depends_on:
  - name: shared-lib
    type: library
  - name: zod
    type: npm
    version: "^3.0.0"

# Quality metrics (0.0 - 1.0)
reliability: 0.95

# Technical debt score (0-10, lower is better)
debt_score: 3
```

### Provides Section

#### CLI Commands

```yaml
provides:
  cli:
    - command: tool run <file>           # Required argument
    - command: tool check [--strict]     # Optional flag
    - command: tool process <in> [out]   # Mixed arguments
```

#### MCP Tools

```yaml
provides:
  mcp:
    - tool: search_items
      schema: schemas/search.json
    - tool: create_item
      schema: schemas/create.json
```

### Depends On Section

```yaml
depends_on:
  # Internal tool dependency
  - name: core-lib
    type: library

  # NPM package dependency
  - name: commander
    type: npm
    version: "^12.0.0"

  # Another PAI tool
  - name: email-service
    type: service
```

### Auto-generating Manifests

pai-deps can analyze your code to generate manifests:

```bash
# Analyze package.json and source code
pai-deps init ~/work/my-tool --analyze

# This detects:
# - CLI commands from package.json bin entries
# - NPM dependencies
# - MCP tool definitions (if present)
```

---

## Development Workflow

### Daily Development

```bash
# 1. Check current health
pai-deps health

# 2. Before modifying a tool, check what depends on it
pai-deps rdeps my-tool

# 3. After changes, verify contracts still work
pai-deps verify my-tool

# 4. Check for schema drift
pai-deps drift my-tool
```

### Adding a New Tool

```bash
# 1. Create manifest
pai-deps init ~/work/new-tool --analyze

# 2. Edit manifest to add dependencies
vim ~/work/new-tool/pai-manifest.yaml

# 3. Register
pai-deps register ~/work/new-tool

# 4. Verify
pai-deps verify new-tool
```

### Modifying an Existing Tool

```bash
# 1. Check blast radius (what could break)
pai-deps blast-radius my-tool

# 2. Check reverse dependencies
pai-deps rdeps my-tool --recursive

# 3. Make your changes...

# 4. Update manifest if contracts changed
vim ~/work/my-tool/pai-manifest.yaml

# 5. Re-register to update
pai-deps register ~/work/my-tool

# 6. Verify nothing broke
pai-deps ci check
```

### Investigating Dependencies

```bash
# What does this tool depend on?
pai-deps deps my-tool

# Full dependency tree
pai-deps deps my-tool --recursive

# What depends on this tool?
pai-deps rdeps my-tool

# Find path between two tools
pai-deps path tool-a tool-b

# Find all paths (detect multiple dependency chains)
pai-deps allpaths tool-a tool-b
```

---

## Command Reference

### Registry Commands

| Command | Description |
|---------|-------------|
| `init <path>` | Generate manifest from source analysis |
| `register <path>` | Register tool from manifest |
| `unregister <tool>` | Remove tool from registry |
| `list` | List all registered tools |
| `show <tool>` | Show detailed tool info |

### Dependency Commands

| Command | Description |
|---------|-------------|
| `deps <tool>` | Forward dependencies |
| `rdeps <tool>` | Reverse dependencies |
| `path <from> <to>` | Shortest dependency path |
| `allpaths <from> <to>` | All dependency paths |
| `graph` | DOT/SVG visualization |

### Verification Commands

| Command | Description |
|---------|-------------|
| `verify [tool]` | Verify CLI contracts |
| `drift [tool]` | Check schema drift |
| `verify-output <tool> <contract>` | Validate runtime output |

### Analysis Commands

| Command | Description |
|---------|-------------|
| `blast-radius <tool>` | Impact analysis |
| `chain-reliability <chain>` | Compound reliability |
| `affected <tool>` | What tools are affected |
| `debt` | Technical debt report |
| `health` | ASCII health dashboard |
| `report` | Comprehensive Markdown report |

### Discovery Commands

| Command | Description |
|---------|-------------|
| `discover [roots...]` | Find manifests |
| `sync [roots...]` | Find and register all |

### CI Commands

| Command | Description |
|---------|-------------|
| `ci check` | Full verification suite |
| `ci check --staged` | Only staged files |
| `ci check --quick` | Fast mode |
| `ci affected` | Tools affected by changes |

### Hook Commands

| Command | Description |
|---------|-------------|
| `hook install` | Install pre-commit hook |
| `hook install --quick` | Install with quick mode |
| `hook install --force` | Overwrite existing hook |
| `hook uninstall` | Remove hook |
| `hook status` | Show hook status |

### Global Options

All commands support:
- `--json` - Machine-readable JSON output
- `-q, --quiet` - Suppress non-essential output
- `-v, --verbose` - Debug information

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deps-check.yml
name: Dependency Check

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Install pai-deps
        run: |
          git clone https://github.com/jfischburg/pai-deps.git /tmp/pai-deps
          cd /tmp/pai-deps && bun install && bun run build
          cp pai-deps ~/bin/
          echo "$HOME/bin" >> $GITHUB_PATH

      - name: Sync tools
        run: pai-deps sync . --quiet

      - name: Run checks
        run: pai-deps ci check --json > results.json

      - name: Check for failures
        run: |
          if ! jq -e '.success' results.json > /dev/null; then
            echo "CI checks failed!"
            jq '.' results.json
            exit 1
          fi
```

### Only Check Affected Tools

```yaml
- name: Check affected tools
  run: |
    # Get list of affected tools
    AFFECTED=$(pai-deps ci affected --base main --list)

    if [ -n "$AFFECTED" ]; then
      echo "Affected tools:"
      echo "$AFFECTED"

      # Verify each affected tool
      for tool in $AFFECTED; do
        pai-deps verify "$tool"
      done
    fi
```

### Using Exit Codes

| Command | Exit 0 | Exit 1 | Exit 2 |
|---------|--------|--------|--------|
| `ci check` | All pass | Failures | Error |
| `verify` | Pass | Failures | Tool not found |
| `drift` | No drift | Drift detected | Error |
| `hook *` | Success | Operation failed | Not git repo |

---

## Pre-commit Hooks

### Installation

```bash
# Basic installation
pai-deps hook install

# With quick mode (faster, less thorough)
pai-deps hook install --quick

# Force install (creates backup of existing hook)
pai-deps hook install --force
```

### What It Does

When you run `git commit`, the hook:

1. Gets list of staged files
2. Maps files to registered tools
3. Runs `pai-deps ci check --staged` on affected tools
4. Blocks commit if any checks fail

### Bypassing the Hook

```bash
# Skip hook for this commit
git commit --no-verify -m "WIP: work in progress"
```

### Checking Status

```bash
# Human-readable
pai-deps hook status

# JSON output
pai-deps hook status --json
```

### Uninstalling

```bash
# Remove the hook
pai-deps hook uninstall

# If you had a previous hook, it's restored from backup
```

---

## Visualization

### Generate Dependency Graph

```bash
# DOT format (for Graphviz)
pai-deps graph > deps.dot
dot -Tsvg deps.dot -o deps.svg

# Or directly to SVG
pai-deps graph --svg -o deps.svg

# Focus on specific tool
pai-deps graph --focus my-tool --depth 2

# Plain text (no colors)
pai-deps graph --no-color
```

### ASCII Health Dashboard

```bash
pai-deps health
```

Output:
```
╔══════════════════════════════════════════════════════════════╗
║                    PAI-DEPS HEALTH DASHBOARD                  ║
╠══════════════════════════════════════════════════════════════╣
║ Tools: 15        Deps: 42        Health: 87%                 ║
╠══════════════════════════════════════════════════════════════╣
║ VERIFICATION                                                  ║
║ ✓ Pass: 12   ✗ Fail: 2   ○ Skip: 1                          ║
║ [████████████████████░░░░] 80%                               ║
╠══════════════════════════════════════════════════════════════╣
║ SCHEMA DRIFT                                                  ║
║ ✓ Current: 13   ⚠ Drift: 2   ✗ Missing: 0                   ║
╠══════════════════════════════════════════════════════════════╣
║ TECHNICAL DEBT                                                ║
║ Low: 8   Medium: 5   High: 2                                 ║
╚══════════════════════════════════════════════════════════════╝
```

### Comprehensive Report

```bash
# Generate Markdown report
pai-deps report > health-report.md

# Or to specific file
pai-deps report -o reports/$(date +%Y-%m-%d).md
```

---

## Best Practices

### 1. Keep Manifests Up to Date

Every time you change a tool's public interface:
- Add or remove CLI commands
- Change argument structure
- Add or remove MCP tools
- Change output schemas

Update the manifest immediately.

### 2. Use Schema Files

For MCP tools, define JSON schemas:

```yaml
provides:
  mcp:
    - tool: search
      schema: schemas/search-input.json
```

```json
// schemas/search-input.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "query": { "type": "string" },
    "limit": { "type": "number", "default": 10 }
  },
  "required": ["query"]
}
```

### 3. Check Blast Radius Before Major Changes

```bash
# Before refactoring core-lib
pai-deps blast-radius core-lib

# Output shows all tools that could be affected
```

### 4. Use Pre-commit Hooks

```bash
pai-deps hook install --quick
```

Catches contract violations before they're committed.

### 5. Run CI Checks on PRs

Add `pai-deps ci check` to your CI pipeline. Block merges if checks fail.

### 6. Set Realistic Reliability Scores

```yaml
# Based on actual uptime/success rate
reliability: 0.95  # 95% success rate
```

Use `pai-deps chain-reliability` to understand compound reliability.

### 7. Track Technical Debt

```yaml
# Honest assessment of code quality
debt_score: 6  # 0=pristine, 10=needs rewrite
```

Use `pai-deps debt` to see aggregated debt across tools.

### 8. Regular Health Checks

```bash
# Weekly health review
pai-deps health
pai-deps report -o weekly-report.md
```

---

## Troubleshooting

### "Tool not found"

```bash
# Check if registered
pai-deps list | grep my-tool

# Re-register
pai-deps register ~/work/my-tool
```

### "Manifest validation failed"

```bash
# Validate manifest syntax
pai-deps init ~/work/my-tool --dry-run

# Common issues:
# - Missing required fields (name, version, type)
# - Invalid YAML syntax
# - Wrong dependency format
```

### "CLI verification failed"

```bash
# Check if command exists
which my-tool

# Run with verbose
pai-deps verify my-tool --verbose

# Common issues:
# - Tool not in PATH
# - Command requires arguments
# - Command exits with non-zero
```

### "Schema drift detected"

```bash
# See what drifted
pai-deps drift my-tool

# Update hash after intentional changes
pai-deps drift my-tool --update

# Or regenerate manifest
pai-deps init ~/work/my-tool --analyze
pai-deps register ~/work/my-tool
```

### "Hook not blocking commits"

```bash
# Check hook status
pai-deps hook status

# Verify hook is executable
ls -la .git/hooks/pre-commit

# Reinstall
pai-deps hook install --force
```

### "CI check takes too long"

```bash
# Use quick mode
pai-deps ci check --quick

# Or only check affected tools
pai-deps ci check --staged
```

### Database Issues

```bash
# Database location
echo $PAI_DEPS_DB  # Default: ~/.pai-deps/pai-deps.db

# Reset database (warning: loses all data)
rm ~/.pai-deps/pai-deps.db
pai-deps sync ~/work
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PAI_DEPS_DB` | Database file path | `~/.pai-deps/pai-deps.db` |

---

## File Locations

| Path | Description |
|------|-------------|
| `~/.pai-deps/pai-deps.db` | SQLite database |
| `~/work/*/pai-manifest.yaml` | Tool manifests |
| `.git/hooks/pre-commit` | Installed hook |
| `.git/hooks/pre-commit.backup` | Backup of previous hook |

---

## Getting Help

```bash
# General help
pai-deps --help

# Command-specific help
pai-deps verify --help
pai-deps ci check --help
```

---

*Last updated: January 2026*
