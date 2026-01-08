/**
 * Tests for list, show, and unregister commands
 *
 * Covers:
 * - List: table output, filters, empty state, JSON
 * - Show: details, dependencies, dependents, errors, JSON
 * - Unregister: remove, force, dependents check, JSON
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { $ } from 'bun';
import { eq } from 'drizzle-orm';
import {
  getDb,
  closeDb,
  resetDb,
  tools,
  dependencies,
} from '../src/db';
import { registerTool } from '../src/lib/registry';

// CLI path
const CLI_PATH = new URL('../src/index.ts', import.meta.url).pathname;

// Fixtures directory
const fixturesDir = join(import.meta.dir, 'fixtures/register');

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-list-show-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('List Command', () => {
  beforeEach(() => {
    resetDb();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    delete process.env['PAI_DEPS_DB'];
  });

  test('shows "No tools registered" when empty', async () => {
    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list`.text();
    expect(result.trim()).toBe('No tools registered');
  });

  test('lists all registered tools in table format', async () => {
    // Register some tools
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list`.text();

    // Check table headers
    expect(result).toContain('ID');
    expect(result).toContain('Type');
    expect(result).toContain('Version');
    expect(result).toContain('Deps');
    expect(result).toContain('Reliability');

    // Check tools appear
    expect(result).toContain('simple-tool');
    expect(result).toContain('tool-with-deps');
    expect(result).toContain('cli');
    expect(result).toContain('cli+mcp');

    // Check footer
    expect(result).toMatch(/\d+ tools \(\d+ stubs?\)/);
  });

  test('shows stub indicator for stub entries', async () => {
    // Register tool with missing dep - creates stub
    registerTool(join(fixturesDir, 'tool-with-missing-dep'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list`.text();

    expect(result).toContain('[stub]');
    expect(result).toContain('nonexistent-provider');
  });

  test('filters by type', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    // Filter by cli only
    const cliResult = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list --type cli`.text();
    expect(cliResult).toContain('simple-tool');
    expect(cliResult).not.toContain('tool-with-deps'); // cli+mcp type

    // Filter by cli+mcp
    const mcpResult = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list --type cli+mcp`.text();
    expect(mcpResult).toContain('tool-with-deps');
    expect(mcpResult).not.toContain('simple-tool');
  });

  test('shows only stubs with --stubs', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-missing-dep'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list --stubs`.text();

    expect(result).toContain('nonexistent-provider');
    expect(result).toContain('another-missing');
    expect(result).not.toContain('simple-tool'); // not a stub
  });

  test('hides stubs with --no-stubs', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-missing-dep'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list --no-stubs`.text();

    expect(result).toContain('simple-tool');
    expect(result).toContain('tool-with-missing-dep');
    expect(result).not.toContain('nonexistent-provider');
    expect(result).not.toContain('another-missing');
  });

  test('outputs JSON with --json flag', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} --json list`.text();
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(Array.isArray(parsed.tools)).toBe(true);
    expect(parsed.total).toBeGreaterThanOrEqual(2);
    expect(typeof parsed.stubs).toBe('number');

    // Check tool structure
    const tool = parsed.tools.find((t: { id: string }) => t.id === 'simple-tool');
    expect(tool).toBeDefined();
    expect(tool.type).toBe('cli');
    expect(tool.version).toBe('1.0.0');
    expect(tool.stub).toBe(false);
  });

  test('JSON output includes dependency count', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} --json list`.text();
    const parsed = JSON.parse(result);

    const toolWithDeps = parsed.tools.find((t: { id: string }) => t.id === 'tool-with-deps');
    expect(toolWithDeps.dependencies).toBe(1);

    const simpleTool = parsed.tools.find((t: { id: string }) => t.id === 'simple-tool');
    expect(simpleTool.dependencies).toBe(0);
  });
});

describe('Show Command', () => {
  beforeEach(() => {
    resetDb();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    delete process.env['PAI_DEPS_DB'];
  });

  test('shows tool details', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} show simple-tool`.text();

    expect(result).toContain('Tool: simple-tool');
    expect(result).toContain('Version: 1.0.0');
    expect(result).toContain('Type: cli');
    expect(result).toContain('Path:');
    expect(result).toContain('Reliability: 0.95');
    expect(result).toContain('Debt Score: 0');
  });

  test('shows dependencies with types and versions', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} show tool-with-deps`.text();

    expect(result).toContain('Dependencies (1)');
    expect(result).toContain('simple-tool');
    expect(result).toContain('(cli)');
    expect(result).toContain('>=1.0.0');
  });

  test('shows dependents', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} show simple-tool`.text();

    expect(result).toContain('Depended on by (1)');
    expect(result).toContain('tool-with-deps');
  });

  test('shows provides from manifest', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} show simple-tool`.text();

    expect(result).toContain('Provides:');
    expect(result).toContain('CLI Commands:');
    expect(result).toContain('simple run');
  });

  test('errors for unknown tool', async () => {
    const proc = Bun.spawn(['bun', CLI_PATH, 'show', 'nonexistent'], {
      env: { ...process.env, PAI_DEPS_DB: TEST_DB_PATH },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Tool 'nonexistent' not found");
  });

  test('outputs JSON with --json flag', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} --json show tool-with-deps`.text();
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.tool).toBeDefined();
    expect(parsed.tool.id).toBe('tool-with-deps');
    expect(parsed.tool.version).toBe('2.0.0');
    expect(parsed.tool.type).toBe('cli+mcp');
    expect(parsed.tool.stub).toBe(false);

    expect(Array.isArray(parsed.dependencies)).toBe(true);
    expect(parsed.dependencies.length).toBe(1);
    expect(parsed.dependencies[0].name).toBe('simple-tool');

    expect(Array.isArray(parsed.dependents)).toBe(true);
  });

  test('JSON error format for unknown tool', async () => {
    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} --json show nonexistent 2>&1 || true`.text();
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("'nonexistent' not found");
  });

  test('shows stub status for stub tools', async () => {
    registerTool(join(fixturesDir, 'tool-with-missing-dep'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} show nonexistent-provider`.text();

    expect(result).toContain('Status: [stub]');
  });
});

describe('Unregister Command', () => {
  beforeEach(() => {
    resetDb();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    delete process.env['PAI_DEPS_DB'];
  });

  test('removes tool from database', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));

    // Verify tool exists
    let db = getDb();
    let storedTools = db.select().from(tools).where(eq(tools.id, 'simple-tool')).all();
    expect(storedTools).toHaveLength(1);

    // Unregister
    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} unregister simple-tool`.text();
    expect(result).toContain('Unregistered simple-tool');

    // Verify tool is gone
    resetDb(); // Reset to get fresh connection
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
    db = getDb();
    storedTools = db.select().from(tools).where(eq(tools.id, 'simple-tool')).all();
    expect(storedTools).toHaveLength(0);
  });

  test('cascade deletes dependencies as consumer', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    // Verify dependency exists
    let db = getDb();
    let deps = db.select().from(dependencies).where(eq(dependencies.consumerId, 'tool-with-deps')).all();
    expect(deps).toHaveLength(1);

    // Unregister the tool that has dependencies
    await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} unregister tool-with-deps`.quiet();

    // Verify dependency is cascade deleted
    resetDb();
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
    db = getDb();
    deps = db.select().from(dependencies).where(eq(dependencies.consumerId, 'tool-with-deps')).all();
    expect(deps).toHaveLength(0);
  });

  test('errors for unknown tool', async () => {
    const proc = Bun.spawn(['bun', CLI_PATH, 'unregister', 'nonexistent'], {
      env: { ...process.env, PAI_DEPS_DB: TEST_DB_PATH },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Tool 'nonexistent' not found");
  });

  test('warns when tool has dependents', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const proc = Bun.spawn(['bun', CLI_PATH, 'unregister', 'simple-tool'], {
      env: { ...process.env, PAI_DEPS_DB: TEST_DB_PATH },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot unregister 'simple-tool'");
    expect(stderr).toContain('tool-with-deps');
    expect(stderr).toContain('--force');
  });

  test('requires --force when dependents exist', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    // Without --force should fail
    const proc = Bun.spawn(['bun', CLI_PATH, 'unregister', 'simple-tool'], {
      env: { ...process.env, PAI_DEPS_DB: TEST_DB_PATH },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    expect(exitCode).toBe(1);

    // Tool should still exist
    const db = getDb();
    const storedTools = db.select().from(tools).where(eq(tools.id, 'simple-tool')).all();
    expect(storedTools).toHaveLength(1);
  });

  test('succeeds with --force even with dependents', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const proc = Bun.spawn(['bun', CLI_PATH, 'unregister', 'simple-tool', '--force'], {
      env: { ...process.env, PAI_DEPS_DB: TEST_DB_PATH },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    expect(stdout).toContain('Unregistered simple-tool');
    expect(stderr).toContain('still reference');

    // Tool should be gone
    resetDb();
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
    const db = getDb();
    const storedTools = db.select().from(tools).where(eq(tools.id, 'simple-tool')).all();
    expect(storedTools).toHaveLength(0);
  });

  test('outputs JSON with --json flag', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} --json unregister simple-tool`.text();
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.action).toBe('unregistered');
    expect(parsed.tool).toBe('simple-tool');
    expect(Array.isArray(parsed.affectedDependents)).toBe(true);
  });

  test('JSON error format for unknown tool', async () => {
    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} --json unregister nonexistent 2>&1 || true`.text();
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("'nonexistent' not found");
  });

  test('JSON output includes dependents when blocked', async () => {
    registerTool(join(fixturesDir, 'simple-tool'));
    registerTool(join(fixturesDir, 'tool-with-deps'));

    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} --json unregister simple-tool 2>&1 || true`.text();
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Tool has dependents');
    expect(parsed.dependents).toContain('tool-with-deps');
    expect(parsed.hint).toContain('--force');
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    resetDb();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    delete process.env['PAI_DEPS_DB'];
  });

  test('commands appear in --help output', async () => {
    const result = await $`bun ${CLI_PATH} --help`.text();

    expect(result).toContain('list');
    expect(result).toContain('show');
    expect(result).toContain('unregister');
  });

  test('full workflow: register, list, show, unregister', async () => {
    // Register
    await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} register ${join(fixturesDir, 'simple-tool')}`.quiet();

    // List
    const listResult = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list`.text();
    expect(listResult).toContain('simple-tool');

    // Show
    const showResult = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} show simple-tool`.text();
    expect(showResult).toContain('Tool: simple-tool');

    // Unregister
    const unregisterResult = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} unregister simple-tool`.text();
    expect(unregisterResult).toContain('Unregistered');

    // List again - should be empty
    const listResult2 = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list`.text();
    expect(listResult2).toContain('No tools registered');
  });

  test('re-register after unregister restores tool', async () => {
    // Register
    await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} register ${join(fixturesDir, 'simple-tool')}`.quiet();

    // Unregister
    await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} unregister simple-tool`.quiet();

    // Re-register
    const result = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} register ${join(fixturesDir, 'simple-tool')}`.text();
    expect(result).toContain('Registered');

    // List should show tool
    const listResult = await $`PAI_DEPS_DB=${TEST_DB_PATH} bun ${CLI_PATH} list`.text();
    expect(listResult).toContain('simple-tool');
  });
});
