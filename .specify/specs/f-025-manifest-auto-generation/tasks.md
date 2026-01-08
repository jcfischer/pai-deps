# Implementation Tasks: F-025 - Manifest Auto-Generation

**Feature ID:** F-025
**Total Estimated Time:** 4 hours
**Parallelizable:** Tasks 1-4 parallel, then 5-7 sequential

---

## Task List

### Task 1: Create analyzer module (`src/lib/analyzer.ts`)
**Time:** 30 min | **Dependencies:** None

Create the analyzer module with types and file discovery:

```typescript
// src/lib/analyzer.ts

/**
 * Source code analyzer for auto-generating pai-manifest.yaml
 */

export interface AnalysisResult {
  cliCommands: string[];
  dependencies: DetectedDep[];
  mcpTools: string[];
  warnings: string[];
}

export interface DetectedDep {
  name: string;
  type: 'library' | 'cli';
  source: 'import' | 'spawn' | 'exec';
}

// Known PAI tools for detection
export const PAI_TOOLS = [
  'resona', 'supertag', 'email', 'ical', 'calendar',
  'tado', 'pii', 'ragent', 'finance', 'reporter',
  'playwright-mcp', 'gutenberg-tana', 'kai-launcher'
];

/**
 * Find TypeScript/JavaScript source files in a directory
 */
export async function findSourceFiles(dir: string): Promise<string[]> {
  const glob = new Bun.Glob('src/**/*.{ts,js}');
  const files: string[] = [];
  for await (const file of glob.scan(dir)) {
    files.push(file);
  }
  return files;
}
```

**Verification:** `findSourceFiles()` returns .ts files from src/

---

### Task 2: Implement Commander.js command detection
**Time:** 40 min | **Dependencies:** Task 1

Add function to detect CLI commands from Commander.js patterns:

```typescript
/**
 * Detect CLI commands from Commander.js patterns
 *
 * Matches patterns like:
 * - .command('search')
 * - .command("list")
 * - program.command('show')
 */
export function detectCommands(sourceCode: string): string[] {
  const COMMAND_PATTERN = /\.command\s*\(\s*['"]([^'"]+)['"]/g;
  const commands: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = COMMAND_PATTERN.exec(sourceCode)) !== null) {
    commands.push(match[1]);
  }

  return [...new Set(commands)]; // Deduplicate
}

/**
 * Analyze all source files for CLI commands
 */
export async function analyzeCliCommands(
  dir: string,
  files: string[]
): Promise<string[]> {
  const commands: string[] = [];

  for (const file of files) {
    const content = await Bun.file(`${dir}/${file}`).text();
    commands.push(...detectCommands(content));
  }

  return [...new Set(commands)];
}
```

**Verification:** Detects commands from test Commander.js file

---

### Task 3: Implement PAI import detection
**Time:** 40 min | **Dependencies:** Task 1

Add function to detect PAI tool imports:

```typescript
/**
 * Detect PAI library imports
 *
 * Matches patterns like:
 * - import { x } from '@pai/resona'
 * - import x from '../../supertag/src'
 * - const x = require('@pai/email')
 */
export function detectPaiImports(sourceCode: string): DetectedDep[] {
  const deps: DetectedDep[] = [];

  // @pai/* imports
  const PAI_IMPORT_PATTERN = /@pai\/(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = PAI_IMPORT_PATTERN.exec(sourceCode)) !== null) {
    if (PAI_TOOLS.includes(match[1])) {
      deps.push({
        name: match[1],
        type: 'library',
        source: 'import',
      });
    }
  }

  // Relative imports containing PAI tool names
  for (const tool of PAI_TOOLS) {
    const pattern = new RegExp(`from\\s+['"].*${tool}.*['"]`, 'g');
    if (pattern.test(sourceCode)) {
      if (!deps.some(d => d.name === tool)) {
        deps.push({
          name: tool,
          type: 'library',
          source: 'import',
        });
      }
    }
  }

  return deps;
}
```

**Verification:** Detects @pai/resona import

---

### Task 4: Implement CLI spawn/exec detection
**Time:** 40 min | **Dependencies:** Task 1

Add function to detect CLI tool executions:

```typescript
/**
 * Detect CLI tool executions via Bun.spawn/exec
 *
 * Matches patterns like:
 * - Bun.spawn(['supertag', 'search'])
 * - exec('email send')
 * - execSync(`${tool} list`)
 */
export function detectCliCalls(sourceCode: string): DetectedDep[] {
  const deps: DetectedDep[] = [];

  // Bun.spawn patterns
  const SPAWN_PATTERN = /Bun\.spawn\s*\(\s*\[\s*['"](\w+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = SPAWN_PATTERN.exec(sourceCode)) !== null) {
    if (PAI_TOOLS.includes(match[1])) {
      deps.push({
        name: match[1],
        type: 'cli',
        source: 'spawn',
      });
    }
  }

  // exec/execSync patterns
  const EXEC_PATTERN = /exec(?:Sync)?\s*\(\s*['"`](\w+)/g;
  while ((match = EXEC_PATTERN.exec(sourceCode)) !== null) {
    if (PAI_TOOLS.includes(match[1])) {
      deps.push({
        name: match[1],
        type: 'cli',
        source: 'exec',
      });
    }
  }

  return deps;
}
```

**Verification:** Detects `Bun.spawn(['supertag'])` call

---

### Task 5: Implement main analyzeProject function
**Time:** 30 min | **Dependencies:** Tasks 1-4

Combine all detection functions:

```typescript
/**
 * Analyze a project directory and detect manifest information
 */
export async function analyzeProject(dir: string): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    cliCommands: [],
    dependencies: [],
    mcpTools: [],
    warnings: [],
  };

  // Find source files
  const files = await findSourceFiles(dir);
  if (files.length === 0) {
    result.warnings.push('No source files found in src/');
    return result;
  }

  // Analyze each file
  for (const file of files) {
    const filePath = `${dir}/${file}`;
    const content = await Bun.file(filePath).text();

    // Detect commands
    result.cliCommands.push(...detectCommands(content));

    // Detect PAI imports
    result.dependencies.push(...detectPaiImports(content));

    // Detect CLI calls
    result.dependencies.push(...detectCliCalls(content));

    // Detect MCP tools (if applicable)
    const mcpTools = detectMcpTools(content);
    result.mcpTools.push(...mcpTools);
  }

  // Deduplicate
  result.cliCommands = [...new Set(result.cliCommands)];
  result.dependencies = deduplicateDeps(result.dependencies);
  result.mcpTools = [...new Set(result.mcpTools)];

  return result;
}

function detectMcpTools(sourceCode: string): string[] {
  const MCP_TOOL_PATTERN = /\.tool\s*\(\s*['"]([^'"]+)['"]/g;
  const tools: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = MCP_TOOL_PATTERN.exec(sourceCode)) !== null) {
    tools.push(match[1]);
  }

  return tools;
}

function deduplicateDeps(deps: DetectedDep[]): DetectedDep[] {
  const seen = new Map<string, DetectedDep>();
  for (const dep of deps) {
    if (!seen.has(dep.name)) {
      seen.set(dep.name, dep);
    }
  }
  return Array.from(seen.values());
}
```

**Verification:** `analyzeProject()` returns all detected info

---

### Task 6: Extend init command with --analyze option
**Time:** 45 min | **Dependencies:** Tasks 1-5

Update `src/commands/init.ts`:

```typescript
import { analyzeProject, AnalysisResult } from '../lib/analyzer';

// Add new options
.option('--analyze, -a', 'Analyze source code to detect provides/depends_on')
.option('--dry-run', 'Show what would be generated without writing')

// In action handler:
let analysis: AnalysisResult | null = null;
if (options.analyze) {
  analysis = await analyzeProject(targetDir);

  // Show warnings
  for (const warning of analysis.warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

// Generate template with analysis
const template = generateManifestTemplate(manifest, analysis);

// Handle dry-run
if (options.dryRun) {
  console.log('=== Manifest Preview (dry run) ===\n');
  console.log(template);
  console.log('[Dry run - no file written]');
  return;
}
```

**Verification:** `pai-deps init . --analyze --dry-run` shows preview

---

### Task 7: Update generateManifestTemplate for analysis data
**Time:** 30 min | **Dependencies:** Task 6

Update `src/lib/detector.ts`:

```typescript
export function generateManifestTemplate(
  info: ManifestInfo,
  analysis?: AnalysisResult | null
): string {
  let yaml = `# PAI Dependency Manifest`;

  if (analysis) {
    yaml += ` (auto-generated)\n# Review and adjust as needed\n`;
  }

  yaml += `
name: ${info.name}
version: ${info.version}
type: ${info.type}
`;

  if (info.description) {
    yaml += `description: ${info.description}\n`;
  }

  yaml += `\nprovides:\n`;

  if (analysis?.cliCommands.length) {
    yaml += `  cli:\n`;
    for (const cmd of analysis.cliCommands) {
      yaml += `    - command: ${info.name} ${cmd}\n`;
    }
  } else {
    yaml += `  # cli:\n  #   - command: "${info.name} <subcommand>"\n`;
  }

  yaml += `\ndepends_on:\n`;

  if (analysis?.dependencies.length) {
    for (const dep of analysis.dependencies) {
      yaml += `  - name: ${dep.name}\n    type: ${dep.type}\n`;
    }
  } else {
    yaml += `  []\n`;
  }

  yaml += `
reliability: 0.95
debt_score: 0
`;

  return yaml;
}
```

**Verification:** Generated manifest includes detected commands and deps

---

### Task 8: Write tests
**Time:** 45 min | **Dependencies:** Tasks 1-7

Create `tests/analyzer.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import {
  detectCommands,
  detectPaiImports,
  detectCliCalls,
  analyzeProject,
} from '../src/lib/analyzer';

describe('analyzer', () => {
  describe('detectCommands', () => {
    test('detects .command() patterns', () => {
      const code = `
        program.command('search')
        .command("list")
        .command('show')
      `;
      expect(detectCommands(code)).toEqual(['search', 'list', 'show']);
    });

    test('returns empty for no commands', () => {
      expect(detectCommands('const x = 1;')).toEqual([]);
    });
  });

  describe('detectPaiImports', () => {
    test('detects @pai/* imports', () => {
      const code = `import { embed } from '@pai/resona';`;
      const deps = detectPaiImports(code);
      expect(deps[0].name).toBe('resona');
      expect(deps[0].type).toBe('library');
    });
  });

  describe('detectCliCalls', () => {
    test('detects Bun.spawn calls', () => {
      const code = `Bun.spawn(['supertag', 'search', query])`;
      const deps = detectCliCalls(code);
      expect(deps[0].name).toBe('supertag');
      expect(deps[0].type).toBe('cli');
    });
  });
});
```

**Verification:** `bun test tests/analyzer.test.ts` passes

---

## Summary

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| 1 | Create analyzer module | 30m | None |
| 2 | Commander.js detection | 40m | 1 |
| 3 | PAI import detection | 40m | 1 |
| 4 | CLI spawn/exec detection | 40m | 1 |
| 5 | Main analyzeProject | 30m | 1-4 |
| 6 | Extend init command | 45m | 1-5 |
| 7 | Update template generation | 30m | 6 |
| 8 | Write tests | 45m | 1-7 |

**Total:** ~300 minutes (~5 hours including buffer)

---

## Doctorow Gate Verification

1. **Failure test:** No src/ directory → falls back gracefully with warning
2. **Failure test:** Invalid source files → skipped, continue analysis
3. **Assumption test:** Regex handles common coding styles
4. **Rollback test:** `--dry-run` allows safe preview before writing
5. **Debt recorded:** Score 4 (heuristic-based detection)

---

## Completion Marker

```
[FEATURE COMPLETE]
Feature: F-025 - Manifest Auto-Generation
Tests: X passing
Files: src/lib/analyzer.ts, src/commands/init.ts, src/lib/detector.ts, tests/analyzer.test.ts
Doctorow Gate: PASSED
```
