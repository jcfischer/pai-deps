# Technical Plan: F-006 - Init Command for Manifest Generation

**Feature ID:** F-006
**Phase:** 1 (Core Registry)
**Estimated Hours:** 2

---

## Approach

Create an init command that generates a pai-manifest.yaml template. Use package.json detection for smart defaults. Generate YAML using template literals (simple, no yaml library needed for writing).

---

## Technical Design

### Architecture

```
src/commands/
├── init.ts          # Init command

src/lib/
├── detector.ts      # Package.json detection logic
└── templates.ts     # Manifest template generation
```

### Init Command (`src/commands/init.ts`)

```typescript
import { Command } from 'commander';
import { detectFromPackageJson, generateManifestTemplate } from '../lib/detector';
import { existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';

export function initCommand(program: Command) {
  program
    .command('init <path>')
    .description('Generate a pai-manifest.yaml template')
    .option('--force', 'Overwrite existing manifest')
    .option('--name <name>', 'Override detected name')
    .option('--type <type>', 'Override detected type')
    .action(async (inputPath: string, options) => {
      const opts = program.opts();
      const targetDir = resolve(inputPath);
      const manifestPath = join(targetDir, 'pai-manifest.yaml');

      // Check existing
      if (existsSync(manifestPath) && !options.force) {
        if (opts.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'pai-manifest.yaml already exists. Use --force to overwrite.',
          }));
        } else {
          console.error('Error: pai-manifest.yaml already exists');
          console.error('Use --force to overwrite.');
        }
        process.exit(1);
      }

      // Detect from package.json
      const detected = await detectFromPackageJson(targetDir);

      // Apply overrides
      const manifest = {
        name: options.name || detected.name || basename(targetDir),
        version: detected.version || '0.1.0',
        type: options.type || detected.type || 'cli',
        description: detected.description || '',
      };

      // Generate template
      const template = generateManifestTemplate(manifest);

      // Write file
      await Bun.write(manifestPath, template);

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          action: 'created',
          path: manifestPath,
          manifest,
        }, null, 2));
      } else {
        console.log('Created pai-manifest.yaml');
        console.log(`  Name: ${manifest.name}`);
        console.log(`  Type: ${manifest.type}`);
        console.log(`  Version: ${manifest.version}`);
        console.log();
        console.log('Next steps:');
        console.log('  1. Edit pai-manifest.yaml to add provides and depends_on');
        console.log(`  2. Run: pai-deps register ${targetDir}`);
      }
    });
}
```

### Detection Logic (`src/lib/detector.ts`)

```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface DetectedInfo {
  name?: string;
  version?: string;
  type?: 'cli' | 'mcp' | 'library';
  description?: string;
}

export async function detectFromPackageJson(dir: string): Promise<DetectedInfo> {
  const pkgPath = join(dir, 'package.json');

  if (!existsSync(pkgPath)) {
    return {};
  }

  try {
    const pkg = await Bun.file(pkgPath).json();
    const result: DetectedInfo = {};

    // Name (strip scope)
    if (pkg.name) {
      result.name = pkg.name.replace(/^@[^/]+\//, '');
    }

    // Version
    if (pkg.version) {
      result.version = pkg.version;
    }

    // Description
    if (pkg.description) {
      result.description = pkg.description;
    }

    // Type detection
    if (pkg.bin) {
      result.type = 'cli';
    } else if (pkg.main?.toLowerCase().includes('mcp') || pkg.name?.includes('mcp')) {
      result.type = 'mcp';
    } else {
      result.type = 'library';
    }

    return result;
  } catch {
    return {};
  }
}

export function generateManifestTemplate(info: {
  name: string;
  version: string;
  type: string;
  description: string;
}): string {
  return `# PAI Dependency Manifest
# Documentation: https://github.com/pai/pai-deps

name: ${info.name}
version: ${info.version}
type: ${info.type}
${info.description ? `description: ${info.description}` : '# description: '}

# What this tool provides to other tools
provides:
  # CLI commands (uncomment and customize)
  # cli:
  #   - command: "${info.name} <subcommand>"
  #     output_schema: ./schemas/output.json

  # MCP tools (uncomment if MCP server)
  # mcp:
  #   - tool: "${info.name}_search"
  #     schema: ./schemas/tool.json

# Dependencies on other PAI tools
depends_on: []
  # Example:
  # - name: resona
  #   type: library
  #   version: ">=1.0.0"

# Reliability estimate (0.0 - 1.0)
reliability: 0.95

# Technical debt score (from SpecKit)
debt_score: 0
`;
}
```

---

## Failure Mode Analysis

| Failure Mode | Trigger | Detection | Recovery |
|--------------|---------|-----------|----------|
| Dir not found | Invalid path | existsSync | Clear error |
| No write permission | Permission denied | Bun.write throws | Clear error |
| Invalid package.json | Malformed JSON | parse throws | Ignore, use defaults |

---

## Implementation Steps

1. Create `src/lib/detector.ts` with detection logic
2. Create `src/commands/init.ts` with command
3. Wire up in `src/index.ts`
4. Create test fixtures (dirs with/without package.json)
5. Create comprehensive tests

---

## Doctorow Gate Checklist

- [ ] **Failure test:** Directory doesn't exist (clear error)
- [ ] **Failure test:** No write permission (clear error)
- [ ] **Rollback test:** Can delete generated manifest
- [ ] **Debt recorded:** Score 2 (simple command)
