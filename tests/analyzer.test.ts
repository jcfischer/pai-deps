/**
 * Tests for source code analyzer (F-025)
 *
 * Tests manifest auto-generation from source code analysis
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectCommands,
  detectPaiImports,
  detectCliCalls,
  detectMcpTools,
  findSourceFiles,
  analyzeProject,
  PAI_TOOLS,
} from '../src/lib/analyzer';

// Test directory for file-based tests
const TEST_DIR = join(tmpdir(), `pai-deps-analyzer-test-${Date.now()}`);

describe('analyzer', () => {
  describe('PAI_TOOLS constant', () => {
    test('contains expected PAI tools', () => {
      expect(PAI_TOOLS).toContain('resona');
      expect(PAI_TOOLS).toContain('supertag');
      expect(PAI_TOOLS).toContain('email');
      expect(PAI_TOOLS).toContain('ical');
      expect(PAI_TOOLS).toContain('calendar');
      expect(PAI_TOOLS).toContain('tado');
      expect(PAI_TOOLS).toContain('pii');
    });
  });

  describe('detectCommands', () => {
    test('detects .command() with single quotes', () => {
      const code = `program.command('search')`;
      expect(detectCommands(code)).toEqual(['search']);
    });

    test('detects .command() with double quotes', () => {
      const code = `.command("list")`;
      expect(detectCommands(code)).toEqual(['list']);
    });

    test('detects multiple commands', () => {
      const code = `
        program.command('search')
        .command("list")
        .command('show')
      `;
      expect(detectCommands(code)).toEqual(['search', 'list', 'show']);
    });

    test('handles command with description chain', () => {
      const code = `
        program
          .command('deps')
          .description('Show forward dependencies')
          .argument('<tool>', 'Tool ID')
      `;
      expect(detectCommands(code)).toEqual(['deps']);
    });

    test('returns empty array for no commands', () => {
      expect(detectCommands('const x = 1;')).toEqual([]);
    });

    test('deduplicates repeated commands', () => {
      const code = `
        program.command('search')
        program.command('search') // duplicate
      `;
      expect(detectCommands(code)).toEqual(['search']);
    });

    test('handles command with angle brackets (arguments)', () => {
      const code = `program.command('show <id>')`;
      expect(detectCommands(code)).toEqual(['show <id>']);
    });
  });

  describe('detectPaiImports', () => {
    test('detects @pai/* imports', () => {
      const code = `import { embed } from '@pai/resona';`;
      const deps = detectPaiImports(code);
      expect(deps.length).toBe(1);
      expect(deps[0]!.name).toBe('resona');
      expect(deps[0]!.type).toBe('library');
      expect(deps[0]!.source).toBe('import');
    });

    test('detects multiple @pai imports', () => {
      const code = `
        import { embed } from '@pai/resona';
        import { send } from '@pai/email';
      `;
      const deps = detectPaiImports(code);
      expect(deps.length).toBe(2);
      expect(deps.map(d => d.name).sort()).toEqual(['email', 'resona']);
    });

    test('ignores unknown @pai imports', () => {
      const code = `import { x } from '@pai/unknown-tool';`;
      const deps = detectPaiImports(code);
      expect(deps.length).toBe(0);
    });

    test('detects PAI tool name in relative import path', () => {
      const code = `import { getDb } from '../../supertag/src/db';`;
      const deps = detectPaiImports(code);
      expect(deps.length).toBe(1);
      expect(deps[0]!.name).toBe('supertag');
    });

    test('returns empty for non-PAI imports', () => {
      const code = `import { join } from 'node:path';`;
      expect(detectPaiImports(code)).toEqual([]);
    });

    test('deduplicates same tool imported multiple times', () => {
      const code = `
        import { embed } from '@pai/resona';
        import { search } from '@pai/resona';
      `;
      const deps = detectPaiImports(code);
      expect(deps.length).toBe(1);
    });
  });

  describe('detectCliCalls', () => {
    test('detects Bun.spawn with PAI tool', () => {
      const code = `Bun.spawn(['supertag', 'search', query])`;
      const deps = detectCliCalls(code);
      expect(deps.length).toBe(1);
      expect(deps[0]!.name).toBe('supertag');
      expect(deps[0]!.type).toBe('cli');
      expect(deps[0]!.source).toBe('spawn');
    });

    test('detects Bun.spawn with double quotes', () => {
      const code = `Bun.spawn(["email", "send"])`;
      const deps = detectCliCalls(code);
      expect(deps.length).toBe(1);
      expect(deps[0]!.name).toBe('email');
    });

    test('detects exec() calls', () => {
      const code = `exec('ical list')`;
      const deps = detectCliCalls(code);
      expect(deps.length).toBe(1);
      expect(deps[0]!.name).toBe('ical');
      expect(deps[0]!.source).toBe('exec');
    });

    test('detects execSync() calls', () => {
      const code = `execSync('tado status')`;
      const deps = detectCliCalls(code);
      expect(deps.length).toBe(1);
      expect(deps[0]!.name).toBe('tado');
    });

    test('ignores non-PAI CLI calls', () => {
      const code = `Bun.spawn(['git', 'status'])`;
      expect(detectCliCalls(code)).toEqual([]);
    });

    test('returns empty for no CLI calls', () => {
      const code = `const x = 1;`;
      expect(detectCliCalls(code)).toEqual([]);
    });
  });

  describe('detectMcpTools', () => {
    test('detects .tool() registrations', () => {
      const code = `server.tool('email_search', ...)`;
      const tools = detectMcpTools(code);
      expect(tools).toEqual(['email_search']);
    });

    test('detects multiple MCP tools', () => {
      const code = `
        server.tool('email_search', ...)
        server.tool('email_send', ...)
      `;
      const tools = detectMcpTools(code);
      expect(tools).toEqual(['email_search', 'email_send']);
    });

    test('returns empty for no MCP tools', () => {
      const code = `const x = 1;`;
      expect(detectMcpTools(code)).toEqual([]);
    });
  });
});

describe('analyzer - file operations', () => {
  beforeEach(() => {
    // Create test directory structure
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('findSourceFiles', () => {
    test('finds .ts files in src/', async () => {
      writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'export const x = 1;');
      writeFileSync(join(TEST_DIR, 'src', 'lib.ts'), 'export const y = 2;');

      const files = await findSourceFiles(TEST_DIR);
      expect(files.length).toBe(2);
      expect(files.some(f => f.includes('index.ts'))).toBe(true);
      expect(files.some(f => f.includes('lib.ts'))).toBe(true);
    });

    test('finds .js files in src/', async () => {
      writeFileSync(join(TEST_DIR, 'src', 'utils.js'), 'const x = 1;');

      const files = await findSourceFiles(TEST_DIR);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('utils.js');
    });

    test('finds files in nested directories', async () => {
      mkdirSync(join(TEST_DIR, 'src', 'lib'), { recursive: true });
      writeFileSync(join(TEST_DIR, 'src', 'lib', 'nested.ts'), 'export const z = 3;');

      const files = await findSourceFiles(TEST_DIR);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('nested.ts');
    });

    test('returns empty for no source files', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      const files = await findSourceFiles(emptyDir);
      expect(files.length).toBe(0);
    });
  });

  describe('analyzeProject', () => {
    test('returns warnings when no source files found', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      const result = await analyzeProject(emptyDir);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('No source files');
    });

    test('detects commands from source files', async () => {
      writeFileSync(join(TEST_DIR, 'src', 'index.ts'), `
        import { Command } from 'commander';
        const program = new Command();
        program.command('search')
        program.command('list')
      `);

      const result = await analyzeProject(TEST_DIR);
      expect(result.cliCommands).toEqual(['search', 'list']);
    });

    test('detects PAI dependencies from source files', async () => {
      writeFileSync(join(TEST_DIR, 'src', 'index.ts'), `
        import { embed } from '@pai/resona';
        Bun.spawn(['supertag', 'search']);
      `);

      const result = await analyzeProject(TEST_DIR);
      expect(result.dependencies.length).toBe(2);
      expect(result.dependencies.find(d => d.name === 'resona')?.type).toBe('library');
      expect(result.dependencies.find(d => d.name === 'supertag')?.type).toBe('cli');
    });

    test('deduplicates dependencies across files', async () => {
      writeFileSync(join(TEST_DIR, 'src', 'a.ts'), `import { x } from '@pai/resona';`);
      writeFileSync(join(TEST_DIR, 'src', 'b.ts'), `import { y } from '@pai/resona';`);

      const result = await analyzeProject(TEST_DIR);
      expect(result.dependencies.filter(d => d.name === 'resona').length).toBe(1);
    });

    test('detects MCP tools', async () => {
      writeFileSync(join(TEST_DIR, 'src', 'server.ts'), `
        server.tool('email_search', ...)
        server.tool('email_stats', ...)
      `);

      const result = await analyzeProject(TEST_DIR);
      expect(result.mcpTools).toEqual(['email_search', 'email_stats']);
    });
  });
});
