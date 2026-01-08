# Technical Plan: F-025 - Manifest Auto-Generation

**Feature ID:** F-025
**Phase:** 6 (Automation)
**Estimated Hours:** 4

---

## Approach

Extend the existing `init` command with `--analyze` flag that performs source code analysis to auto-detect CLI commands and dependencies. Use regex-based pattern matching on TypeScript/JavaScript files to detect Commander.js command registrations and PAI tool imports/executions.

---

## Technical Design

### Architecture

```
src/lib/
├── detector.ts      # EXTEND: Add analyzer functions
└── analyzer.ts      # NEW: Source code analysis logic

src/commands/
└── init.ts          # EXTEND: Add --analyze option
```

### New Module: analyzer.ts

```typescript
// src/lib/analyzer.ts

interface AnalysisResult {
  cliCommands: string[];      // Detected CLI commands
  dependencies: DetectedDep[]; // Detected dependencies
  mcpTools: string[];         // Detected MCP tools (if MCP project)
}

interface DetectedDep {
  name: string;
  type: 'library' | 'cli';
  source: 'import' | 'spawn' | 'exec';
}

export async function analyzeProject(dir: string): Promise<AnalysisResult>;
```

### Analysis Flow

```
1. Read package.json for basic info (existing)
2. If --analyze flag:
   a. Find TypeScript/JavaScript source files
   b. Detect Commander.js commands
   c. Detect PAI imports
   d. Detect CLI spawn/exec calls
   e. Merge into manifest template
3. Generate enhanced pai-manifest.yaml
```

### Pattern Detection

#### Commander.js Command Detection
```typescript
// Regex patterns for Commander.js
const COMMAND_PATTERN = /\.command\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// Match: .command('search'), .command("list")
// Extract: "search", "list"
```

#### PAI Import Detection
```typescript
// Known PAI tool patterns
const PAI_TOOLS = [
  'resona', 'supertag', 'email', 'ical', 'calendar',
  'tado', 'pii', 'ragent', 'finance', 'reporter', 'playwright-mcp'
];

// Import patterns
const PAI_IMPORT_PATTERN = /@pai\/(\w+)/g;        // @pai/resona
const RELATIVE_IMPORT = /from\s+['"]\.\.\/.*?(\w+)\/src/g;  // ../supertag/src
```

#### CLI Execution Detection
```typescript
// Spawn/exec patterns
const SPAWN_PATTERN = /Bun\.spawn\s*\(\s*\[\s*['"](\w+)['"]/g;
const EXEC_PATTERN = /exec(?:Sync)?\s*\(\s*['"](\w+)/g;
```

### File Discovery

```typescript
async function findSourceFiles(dir: string): Promise<string[]> {
  // Find .ts and .js files in src/ directory
  const glob = new Bun.Glob('src/**/*.{ts,js}');
  return Array.from(glob.scanSync(dir));
}
```

---

## Extended Manifest Template

```yaml
# PAI Dependency Manifest (auto-generated)
# Analyzed at: 2026-01-08T10:00:00Z
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

reliability: 0.95
debt_score: 0
```

---

## Failure Mode Analysis

| Failure Mode | Trigger | Detection | Recovery |
|--------------|---------|-----------|----------|
| No src directory | Project structure varies | Check for src/ | Fallback to basic template |
| Invalid source files | Syntax errors | Regex fails silently | Skip file, continue |
| False positives | Regex too broad | User review | Manifest is editable |
| Missing PAI tool | Unknown tool called | Not in PAI_TOOLS list | Log warning, still include |

---

## Implementation Steps

1. Create `src/lib/analyzer.ts` with analysis functions
2. Implement Commander.js command detection
3. Implement PAI import detection
4. Implement CLI spawn/exec detection
5. Extend `init` command with `--analyze` and `--dry-run` options
6. Update `generateManifestTemplate` to include detected data
7. Write tests for analyzer
8. Write integration tests for `init --analyze`

---

## Test Strategy

### Unit Tests (analyzer.ts)
- `detectCommands()` - various Commander.js patterns
- `detectPaiImports()` - @pai/*, relative imports
- `detectCliCalls()` - Bun.spawn, exec patterns

### Integration Tests (init command)
- `init --analyze` on project with Commander.js
- `init --analyze` on project with PAI imports
- `init --analyze --dry-run` shows preview
- `init` (without analyze) - unchanged behavior

---

## Doctorow Gate Checklist

- [ ] **Failure test:** Missing src/ falls back gracefully
- [ ] **Failure test:** Invalid source files don't crash
- [ ] **Assumption test:** Regex handles various coding styles
- [ ] **Rollback test:** --dry-run allows safe preview
- [ ] **Debt recorded:** Score 4 (heuristic-based feature)
