# Feature Specification: F-025 - Manifest Auto-Generation

**Feature ID:** F-025
**Phase:** 6 (Automation)
**Priority:** 3
**Estimated Hours:** 4
**Reliability Target:** 0.90 (analysis-based, some heuristics)
**Dependencies:** F-003 (Manifest specification), F-006 (Init command)

---

## Summary

Enhance the `pai-deps init` command to auto-generate more complete `pai-manifest.yaml` files by analyzing TypeScript/JavaScript source code. Detect CLI commands from Commander.js patterns, detect dependencies from import statements, and identify PAI tool dependencies.

---

## Problem Statement

The current `init` command creates minimal templates requiring manual editing:
- `provides` section is commented out
- `depends_on` is empty
- Users must manually list CLI commands and dependencies

This creates friction and inaccurate manifests.

---

## User Scenarios

### Scenario 1: Analyze TypeScript CLI Project
**Given** a TypeScript project using Commander.js at `~/work/email/`
**When** running `pai-deps init ~/work/email/ --analyze`
**Then** generates pai-manifest.yaml with:
- Detected CLI commands from Commander.js `.command()` calls
- Detected npm dependencies from package.json
- Detected PAI tool dependencies from imports

### Scenario 2: Detect PAI Tool Dependencies
**Given** source file imports `@pai/resona` and calls `supertag search`
**When** running `pai-deps init . --analyze`
**Then** `depends_on` includes:
- `resona` (type: library, from import)
- `supertag` (type: cli, from exec/spawn call)

### Scenario 3: Detect MCP Server
**Given** a project with `@modelcontextprotocol/sdk` dependency
**When** running `pai-deps init . --analyze`
**Then** type is detected as `mcp`
**And** MCP tools are detected from `.tool()` calls

### Scenario 4: No Analysis (default behavior unchanged)
**Given** a TypeScript project
**When** running `pai-deps init .` (without --analyze)
**Then** generates basic template (existing behavior preserved)

### Scenario 5: Analysis with Missing Source
**Given** a project with package.json but no src/ directory
**When** running `pai-deps init . --analyze`
**Then** falls back to basic template
**And** shows warning: "No source files found for analysis"

---

## Functional Requirements

### FR-1: Command Enhancement
```bash
pai-deps init <path> [options]

New Options:
  --analyze, -a       Analyze source code to detect provides/depends_on
  --dry-run          Show what would be generated without writing
```

### FR-2: CLI Command Detection
Detect CLI commands from Commander.js patterns:
```typescript
// Pattern 1: .command('name')
program.command('search')  // -> detects 'toolname search'

// Pattern 2: .command('name').description('...')
program.command('list')    // -> detects 'toolname list'
  .description('List items')
```

### FR-3: PAI Dependency Detection
Detect PAI tool dependencies from:
```typescript
// Import patterns
import { something } from '@pai/resona'     // -> resona (library)
import { getDb } from '../../supertag/src'  // -> supertag (library)

// CLI execution patterns (in Bun.spawn, exec, etc.)
Bun.spawn(['supertag', 'search'])           // -> supertag (cli)
exec('email send')                          // -> email (cli)
```

### FR-4: MCP Detection
If project has `@modelcontextprotocol/sdk` dependency:
- Set type to `mcp`
- Look for `.tool()` calls in source

### FR-5: Generated Manifest Format
```yaml
# PAI Dependency Manifest (auto-generated)
# Review and adjust as needed

name: email
version: 1.2.0
type: cli
description: Email CLI with SMTP/IMAP support

provides:
  cli:
    - command: email search
    - command: email send
    - command: email stats

depends_on:
  - name: resona
    type: library
  - name: supertag
    type: cli
    commands:
      - supertag search

reliability: 0.95
debt_score: 0
```

### FR-6: Dry Run Output
```
=== Manifest Preview (dry run) ===

Name:    email
Version: 1.2.0
Type:    cli

Detected CLI commands:
  - email search
  - email send
  - email stats

Detected dependencies:
  - resona (library)
  - supertag (cli, commands: search)

[Dry run - no file written]
```

### FR-7: JSON Output
```json
{
  "success": true,
  "action": "created",
  "path": "/path/to/pai-manifest.yaml",
  "analysis": {
    "commands_detected": 3,
    "dependencies_detected": 2,
    "type_detected": "cli"
  },
  "manifest": {
    "name": "email",
    "type": "cli",
    "version": "1.2.0"
  }
}
```

---

## Non-Functional Requirements

### NFR-1: Performance
- Analysis completes in < 5 seconds for projects with 100 source files

### NFR-2: Accuracy
- CLI command detection should be > 90% accurate
- Dependency detection should be > 80% accurate
- Err on side of inclusion (false positives better than false negatives)

### NFR-3: Backward Compatibility
- Without --analyze flag, behavior is unchanged
- Existing tests continue to pass

---

## Implementation Strategy

### Source Analysis Approach
1. Parse TypeScript files using Bun's bundler or regex patterns
2. Look for Commander.js patterns: `.command(`, `.tool(`
3. Look for PAI imports: `@pai/`, known tool names
4. Look for CLI executions: `Bun.spawn`, `exec`, `execSync`

### Known PAI Tools (for detection)
```typescript
const PAI_TOOLS = [
  'resona', 'supertag', 'email', 'ical', 'calendar',
  'tado', 'pii', 'ragent', 'finance', 'reporter'
];
```

---

## Acceptance Criteria

- [ ] `pai-deps init . --analyze` generates complete manifest
- [ ] CLI commands detected from Commander.js patterns
- [ ] PAI tool dependencies detected from imports
- [ ] PAI CLI dependencies detected from spawn/exec calls
- [ ] MCP type detected from SDK dependency
- [ ] `--dry-run` shows preview without writing
- [ ] Existing `init` behavior unchanged without `--analyze`
- [ ] All existing tests pass
- [ ] New tests for analysis functionality

---

## Out of Scope

- Full TypeScript AST parsing (use regex/simple patterns)
- Detection of non-PAI dependencies from CLI calls
- Version constraint detection
- Schema file generation

---

## References

- F-003: Manifest specification format
- F-006: Init command (basic template generation)
- Design Doc: Phase 6 - Automation section
