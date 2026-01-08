/**
 * Tests for the init command
 *
 * Covers:
 * - Detection from package.json (name, version, type)
 * - Template generation
 * - Command behavior (create, force, overrides)
 * - Error handling
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectFromPackageJson, generateManifestTemplate } from '../src/lib/detector';

// Fixtures directory
const fixturesDir = join(import.meta.dir, 'fixtures/init');

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-init-test-${Date.now()}`);

describe('Package.json Detection', () => {
  test('detects name from package.json (strips scope)', async () => {
    const result = await detectFromPackageJson(join(fixturesDir, 'with-package-json'));

    expect(result.name).toBe('my-cli-tool');
  });

  test('detects version from package.json', async () => {
    const result = await detectFromPackageJson(join(fixturesDir, 'with-package-json'));

    expect(result.version).toBe('2.5.0');
  });

  test('detects CLI type from bin field', async () => {
    const result = await detectFromPackageJson(join(fixturesDir, 'with-package-json'));

    expect(result.type).toBe('cli');
  });

  test('detects library type without bin field', async () => {
    const result = await detectFromPackageJson(join(fixturesDir, 'library-package'));

    expect(result.type).toBe('library');
  });

  test('detects MCP type from name containing mcp', async () => {
    const result = await detectFromPackageJson(join(fixturesDir, 'mcp-package'));

    expect(result.type).toBe('mcp');
  });

  test('detects description from package.json', async () => {
    const result = await detectFromPackageJson(join(fixturesDir, 'with-package-json'));

    expect(result.description).toBe('A CLI tool for testing');
  });

  test('returns empty object when no package.json', async () => {
    const result = await detectFromPackageJson(join(fixturesDir, 'no-package-json'));

    expect(result).toEqual({});
  });

  test('returns empty object for invalid package.json', async () => {
    // Create temp dir with invalid package.json
    const badDir = join(TEST_DIR, 'bad-package');
    mkdirSync(badDir, { recursive: true });
    await Bun.write(join(badDir, 'package.json'), 'not valid json');

    const result = await detectFromPackageJson(badDir);

    expect(result).toEqual({});

    // Cleanup
    rmSync(badDir, { recursive: true, force: true });
  });
});

describe('Template Generation', () => {
  test('generates valid template with all fields', () => {
    const template = generateManifestTemplate({
      name: 'my-tool',
      version: '1.0.0',
      type: 'cli',
      description: 'Test tool',
    });

    expect(template).toContain('name: my-tool');
    expect(template).toContain('version: 1.0.0');
    expect(template).toContain('type: cli');
    expect(template).toContain('description: Test tool');
  });

  test('template includes commented description when empty', () => {
    const template = generateManifestTemplate({
      name: 'my-tool',
      version: '1.0.0',
      type: 'cli',
      description: '',
    });

    expect(template).toContain('# description:');
  });

  test('template includes required fields', () => {
    const template = generateManifestTemplate({
      name: 'my-tool',
      version: '1.0.0',
      type: 'cli',
      description: '',
    });

    expect(template).toContain('reliability: 0.95');
    expect(template).toContain('debt_score: 0');
    expect(template).toContain('provides:');
    expect(template).toContain('depends_on: []');
  });

  test('template includes commented example sections', () => {
    const template = generateManifestTemplate({
      name: 'my-tool',
      version: '1.0.0',
      type: 'cli',
      description: '',
    });

    expect(template).toContain('#   - command:');
  });

  test('template uses tool name in command example', () => {
    const template = generateManifestTemplate({
      name: 'email',
      version: '1.0.0',
      type: 'cli',
      description: '',
    });

    expect(template).toContain('"email <subcommand>"');
  });
});

describe('Init Command', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test('creates manifest in directory with package.json', async () => {
    // Copy fixture to temp
    const testToolDir = join(TEST_DIR, 'test-tool');
    mkdirSync(testToolDir, { recursive: true });
    await Bun.write(
      join(testToolDir, 'package.json'),
      JSON.stringify({
        name: '@scope/test-cli',
        version: '3.0.0',
        bin: { 'test-cli': './index.js' },
      })
    );

    // Run init command
    const proc = Bun.spawn(['bun', 'run', 'src/index.ts', 'init', testToolDir], {
      cwd: '/Users/fischer/work/pai-deps',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    // Check manifest created
    const manifestPath = join(testToolDir, 'pai-manifest.yaml');
    expect(existsSync(manifestPath)).toBe(true);

    // Check content
    const content = readFileSync(manifestPath, 'utf-8');
    expect(content).toContain('name: test-cli');
    expect(content).toContain('version: 3.0.0');
    expect(content).toContain('type: cli');
  });

  test('uses directory name when no package.json', async () => {
    const testToolDir = join(TEST_DIR, 'my-cool-tool');
    mkdirSync(testToolDir, { recursive: true });

    // Run init command
    const proc = Bun.spawn(['bun', 'run', 'src/index.ts', 'init', testToolDir], {
      cwd: '/Users/fischer/work/pai-deps',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    // Check content
    const content = readFileSync(join(testToolDir, 'pai-manifest.yaml'), 'utf-8');
    expect(content).toContain('name: my-cool-tool');
    expect(content).toContain('version: 0.1.0');
    expect(content).toContain('type: cli');
  });

  test('errors when manifest already exists', async () => {
    // Use existing-manifest fixture
    const proc = Bun.spawn(
      ['bun', 'run', 'src/index.ts', 'init', join(fixturesDir, 'existing-manifest')],
      {
        cwd: '/Users/fischer/work/pai-deps',
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain('already exists');
  });

  test('--force overwrites existing manifest', async () => {
    // Copy existing-manifest to temp
    const testToolDir = join(TEST_DIR, 'force-test');
    mkdirSync(testToolDir, { recursive: true });
    await Bun.write(join(testToolDir, 'pai-manifest.yaml'), 'name: old-content');
    await Bun.write(
      join(testToolDir, 'package.json'),
      JSON.stringify({ name: 'new-tool', version: '1.0.0', bin: { x: './x' } })
    );

    // Run init with --force
    const proc = Bun.spawn(
      ['bun', 'run', 'src/index.ts', 'init', testToolDir, '--force'],
      {
        cwd: '/Users/fischer/work/pai-deps',
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );
    await proc.exited;

    // Check content was replaced
    const content = readFileSync(join(testToolDir, 'pai-manifest.yaml'), 'utf-8');
    expect(content).toContain('name: new-tool');
    expect(content).not.toContain('old-content');
  });

  test('--name overrides detected name', async () => {
    const testToolDir = join(TEST_DIR, 'name-override');
    mkdirSync(testToolDir, { recursive: true });
    await Bun.write(
      join(testToolDir, 'package.json'),
      JSON.stringify({ name: 'detected-name', version: '1.0.0' })
    );

    // Run init with --name
    const proc = Bun.spawn(
      ['bun', 'run', 'src/index.ts', 'init', testToolDir, '--name', 'custom-name'],
      {
        cwd: '/Users/fischer/work/pai-deps',
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );
    await proc.exited;

    const content = readFileSync(join(testToolDir, 'pai-manifest.yaml'), 'utf-8');
    expect(content).toContain('name: custom-name');
  });

  test('--type overrides detected type', async () => {
    const testToolDir = join(TEST_DIR, 'type-override');
    mkdirSync(testToolDir, { recursive: true });
    await Bun.write(
      join(testToolDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0', bin: { x: './x' } })
    );

    // Run init with --type (should override cli detection from bin)
    const proc = Bun.spawn(
      ['bun', 'run', 'src/index.ts', 'init', testToolDir, '--type', 'mcp'],
      {
        cwd: '/Users/fischer/work/pai-deps',
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );
    await proc.exited;

    const content = readFileSync(join(testToolDir, 'pai-manifest.yaml'), 'utf-8');
    expect(content).toContain('type: mcp');
  });

  test('JSON output format is correct', async () => {
    const testToolDir = join(TEST_DIR, 'json-output');
    mkdirSync(testToolDir, { recursive: true });
    await Bun.write(
      join(testToolDir, 'package.json'),
      JSON.stringify({ name: 'json-test', version: '2.0.0', bin: { x: './x' } })
    );

    // Run init with --json
    const proc = Bun.spawn(
      ['bun', 'run', 'src/index.ts', '--json', 'init', testToolDir],
      {
        cwd: '/Users/fischer/work/pai-deps',
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );
    await proc.exited;

    const stdout = await new Response(proc.stdout).text();
    const result = JSON.parse(stdout);

    expect(result.success).toBe(true);
    expect(result.action).toBe('created');
    expect(result.path).toContain('pai-manifest.yaml');
    expect(result.manifest.name).toBe('json-test');
    expect(result.manifest.version).toBe('2.0.0');
    expect(result.manifest.type).toBe('cli');
  });

  test('errors on nonexistent directory', async () => {
    const proc = Bun.spawn(
      ['bun', 'run', 'src/index.ts', 'init', '/nonexistent/path/to/tool'],
      {
        cwd: '/Users/fischer/work/pai-deps',
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Directory not found');
  });

  test('JSON error format is correct', async () => {
    const proc = Bun.spawn(
      ['bun', 'run', 'src/index.ts', '--json', 'init', '/nonexistent/path'],
      {
        cwd: '/Users/fischer/work/pai-deps',
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const result = JSON.parse(stdout);

    expect(exitCode).toBe(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Directory not found');
  });
});

describe('Generated Manifest Validity', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test('generated manifest is valid YAML', async () => {
    const { parse } = await import('yaml');

    const testToolDir = join(TEST_DIR, 'valid-yaml');
    mkdirSync(testToolDir, { recursive: true });
    await Bun.write(
      join(testToolDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    );

    const proc = Bun.spawn(['bun', 'run', 'src/index.ts', 'init', testToolDir], {
      cwd: '/Users/fischer/work/pai-deps',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    const content = readFileSync(join(testToolDir, 'pai-manifest.yaml'), 'utf-8');

    // Should parse without throwing
    const parsed = parse(content);
    expect(parsed.name).toBe('test');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.reliability).toBe(0.95);
    expect(parsed.debt_score).toBe(0);
    expect(Array.isArray(parsed.depends_on)).toBe(true);
  });
});
