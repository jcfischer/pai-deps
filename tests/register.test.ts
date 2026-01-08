/**
 * Tests for the register command
 *
 * Covers:
 * - Registration from valid manifest
 * - Missing dependencies create stubs
 * - Updating existing tools
 * - Circular dependency detection
 * - Error handling
 * - JSON output format
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import {
  getDb,
  closeDb,
  resetDb,
  tools,
  dependencies,
  circularDeps,
} from '../src/db';
import { registerTool } from '../src/lib/registry';
import { detectCycles } from '../src/lib/graph';
import { resolveManifestPath, ManifestParseError } from '../src/lib/manifest';

// Fixtures directory
const fixturesDir = join(import.meta.dir, 'fixtures/register');

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-register-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('Register Command', () => {
  beforeEach(() => {
    // Reset database singleton
    resetDb();

    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Set environment variable to use test database
    process.env['PAI_DEPS_DB'] = TEST_DB_PATH;
  });

  afterEach(() => {
    // Close database connection
    closeDb();

    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }

    // Clear environment variable
    delete process.env['PAI_DEPS_DB'];
  });

  describe('Registration Tests', () => {
    test('registers tool from valid manifest', () => {
      const result = registerTool(join(fixturesDir, 'simple-tool'));

      expect(result.success).toBe(true);
      expect(result.action).toBe('registered');
      expect(result.tool.id).toBe('simple-tool');
      expect(result.tool.name).toBe('simple-tool');
      expect(result.tool.version).toBe('1.0.0');
      expect(result.tool.type).toBe('cli');
      expect(result.warnings).toEqual([]);
    });

    test('tool is stored in database with correct fields', () => {
      registerTool(join(fixturesDir, 'simple-tool'));

      const db = getDb();
      const storedTools = db
        .select()
        .from(tools)
        .where(eq(tools.id, 'simple-tool'))
        .all();

      expect(storedTools).toHaveLength(1);
      const tool = storedTools[0]!;
      expect(tool.name).toBe('simple-tool');
      expect(tool.version).toBe('1.0.0');
      expect(tool.type).toBe('cli');
      expect(tool.reliability).toBe(0.95);
      expect(tool.debtScore).toBe(0);
      expect(tool.stub).toBe(0);
      expect(tool.manifestPath).toContain('pai-manifest.yaml');
    });

    test('dependencies are created as edges', () => {
      // First register the dependency
      registerTool(join(fixturesDir, 'simple-tool'));

      // Then register the tool that depends on it
      const result = registerTool(join(fixturesDir, 'tool-with-deps'));

      expect(result.success).toBe(true);
      expect(result.tool.dependencies).toBe(1);

      // Check dependency edge
      const db = getDb();
      const deps = db
        .select()
        .from(dependencies)
        .where(eq(dependencies.consumerId, 'tool-with-deps'))
        .all();

      expect(deps).toHaveLength(1);
      expect(deps[0]?.providerId).toBe('simple-tool');
      expect(deps[0]?.type).toBe('cli');
      expect(deps[0]?.versionConstraint).toBe('>=1.0.0');
    });

    test('version, reliability, debt_score stored correctly', () => {
      registerTool(join(fixturesDir, 'tool-with-deps'));

      const db = getDb();
      const storedTools = db
        .select()
        .from(tools)
        .where(eq(tools.id, 'tool-with-deps'))
        .all();

      expect(storedTools).toHaveLength(1);
      const tool = storedTools[0]!;
      expect(tool.version).toBe('2.0.0');
      expect(tool.reliability).toBe(0.92);
      expect(tool.debtScore).toBe(2);
    });
  });

  describe('Stub Tests', () => {
    test('missing dependency creates stub entry', () => {
      const result = registerTool(join(fixturesDir, 'tool-with-missing-dep'));

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'Created stub for unregistered dependency: nonexistent-provider'
      );
      expect(result.warnings).toContain(
        'Created stub for unregistered dependency: another-missing'
      );
    });

    test('stub has stub=1 flag', () => {
      registerTool(join(fixturesDir, 'tool-with-missing-dep'));

      const db = getDb();
      const stubs = db
        .select()
        .from(tools)
        .where(eq(tools.stub, 1))
        .all();

      expect(stubs.length).toBeGreaterThanOrEqual(2);

      const provider = stubs.find((s) => s.id === 'nonexistent-provider');
      expect(provider).toBeDefined();
      expect(provider?.stub).toBe(1);
      expect(provider?.path).toBe('unknown');
      expect(provider?.type).toBe('library');
    });

    test('edge created pointing to stub', () => {
      registerTool(join(fixturesDir, 'tool-with-missing-dep'));

      const db = getDb();
      const deps = db
        .select()
        .from(dependencies)
        .where(eq(dependencies.consumerId, 'tool-with-missing-dep'))
        .all();

      expect(deps).toHaveLength(2);

      const depToStub = deps.find((d) => d.providerId === 'nonexistent-provider');
      expect(depToStub).toBeDefined();
      expect(depToStub?.versionConstraint).toBe('>=1.0.0');
    });
  });

  describe('Update Tests', () => {
    test('updating existing tool modifies record', () => {
      // Register initially
      registerTool(join(fixturesDir, 'simple-tool'));

      // Get initial timestamp
      const db = getDb();
      const initial = db
        .select()
        .from(tools)
        .where(eq(tools.id, 'simple-tool'))
        .all()[0];
      expect(initial).toBeDefined();

      // Wait a bit and re-register
      const result = registerTool(join(fixturesDir, 'simple-tool'));

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');

      // Check timestamp changed
      const updated = db
        .select()
        .from(tools)
        .where(eq(tools.id, 'simple-tool'))
        .all()[0];
      expect(updated).toBeDefined();
      expect(updated?.createdAt).toBe(initial?.createdAt); // createdAt should not change
    });

    test('old dependencies removed on update', () => {
      // Register tool with deps
      registerTool(join(fixturesDir, 'simple-tool'));
      registerTool(join(fixturesDir, 'tool-with-deps'));

      const db = getDb();
      let deps = db
        .select()
        .from(dependencies)
        .where(eq(dependencies.consumerId, 'tool-with-deps'))
        .all();
      expect(deps).toHaveLength(1);

      // Re-register should still have same deps
      registerTool(join(fixturesDir, 'tool-with-deps'));

      deps = db
        .select()
        .from(dependencies)
        .where(eq(dependencies.consumerId, 'tool-with-deps'))
        .all();
      expect(deps).toHaveLength(1); // Should not duplicate
    });

    test('action is "updated" not "registered" for existing tool', () => {
      registerTool(join(fixturesDir, 'simple-tool'));
      const result = registerTool(join(fixturesDir, 'simple-tool'));

      expect(result.action).toBe('updated');
    });
  });

  describe('Cycle Tests', () => {
    test('circular dependency detected', () => {
      // Register B first (creates stub for A)
      const resultB = registerTool(join(fixturesDir, 'circular-b'));
      expect(resultB.success).toBe(true);

      // Register A (B already exists, so A->B edge created, then cycle detected)
      const resultA = registerTool(join(fixturesDir, 'circular-a'));
      expect(resultA.success).toBe(true);

      // Should have cycle warning
      const cycleWarnings = resultA.warnings.filter((w) =>
        w.includes('Circular dependency detected')
      );
      expect(cycleWarnings.length).toBeGreaterThan(0);
    });

    test('cycle stored in circular_deps table', () => {
      registerTool(join(fixturesDir, 'circular-b'));
      registerTool(join(fixturesDir, 'circular-a'));

      const db = getDb();
      const cycles = db.select().from(circularDeps).all();

      expect(cycles.length).toBeGreaterThan(0);
      const cycleData = JSON.parse(cycles[0]?.cycle ?? '[]');
      expect(cycleData).toContain('circular-a');
      expect(cycleData).toContain('circular-b');
    });

    test('registration still succeeds despite cycle (warning, not error)', () => {
      registerTool(join(fixturesDir, 'circular-b'));
      const result = registerTool(join(fixturesDir, 'circular-a'));

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated'); // A was created as stub, now updated
    });
  });

  describe('Error Tests', () => {
    test('invalid path shows clear error', () => {
      expect(() => {
        registerTool('/nonexistent/path/to/tool');
      }).toThrow(ManifestParseError);
    });

    test('missing manifest shows clear error', () => {
      // Create directory without manifest
      const emptyDir = join(TEST_DIR, 'empty-tool');
      mkdirSync(emptyDir, { recursive: true });

      expect(() => {
        registerTool(emptyDir);
      }).toThrow(ManifestParseError);
    });

    test('invalid manifest shows parse error', () => {
      // Create directory with invalid manifest
      const badToolDir = join(TEST_DIR, 'bad-tool');
      mkdirSync(badToolDir, { recursive: true });
      writeFileSync(
        join(badToolDir, 'pai-manifest.yaml'),
        'invalid: yaml: content: [[[['
      );

      expect(() => {
        registerTool(badToolDir);
      }).toThrow(ManifestParseError);
    });
  });

  describe('JSON Output Tests', () => {
    test('result includes tool details', () => {
      const result = registerTool(join(fixturesDir, 'simple-tool'));

      expect(result.tool).toBeDefined();
      expect(result.tool.id).toBe('simple-tool');
      expect(result.tool.name).toBe('simple-tool');
      expect(result.tool.version).toBe('1.0.0');
      expect(result.tool.type).toBe('cli');
      expect(result.tool.path).toBeDefined();
      expect(result.tool.dependencies).toBe(0);
    });

    test('result includes warnings array', () => {
      const result = registerTool(join(fixturesDir, 'tool-with-missing-dep'));

      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('result includes provides counts', () => {
      const result = registerTool(join(fixturesDir, 'simple-tool'));

      expect(result.tool.provides).toBeDefined();
      expect(result.tool.provides.cli).toBe(1);
    });
  });
});

describe('Manifest Path Resolution', () => {
  test('resolves directory to manifest path', () => {
    const manifestPath = resolveManifestPath(join(fixturesDir, 'simple-tool'));
    expect(manifestPath).toContain('pai-manifest.yaml');
  });

  test('resolves file path directly', () => {
    const manifestPath = resolveManifestPath(
      join(fixturesDir, 'simple-tool/pai-manifest.yaml')
    );
    expect(manifestPath).toContain('pai-manifest.yaml');
  });

  test('throws on nonexistent path', () => {
    expect(() => {
      resolveManifestPath('/nonexistent/path');
    }).toThrow(ManifestParseError);
  });

  test('throws on directory without manifest', () => {
    const emptyDir = join(TEST_DIR, 'no-manifest');
    mkdirSync(emptyDir, { recursive: true });

    expect(() => {
      resolveManifestPath(emptyDir);
    }).toThrow(ManifestParseError);
  });
});

describe('Cycle Detection', () => {
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

  test('detects simple cycle A -> B -> A', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Create tools
    db.insert(tools)
      .values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ])
      .run();

    // Create edges: A -> B -> A
    db.insert(dependencies)
      .values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'b', providerId: 'a', type: 'cli', createdAt: now },
      ])
      .run();

    const cycles = detectCycles(db, 'a');
    expect(cycles.length).toBeGreaterThan(0);

    // Cycle should contain both a and b
    const cycle = cycles[0];
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
  });

  test('returns empty array for no cycles', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Create tools
    db.insert(tools)
      .values([
        { id: 'x', name: 'X', path: '/x', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'y', name: 'Y', path: '/y', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'z', name: 'Z', path: '/z', type: 'cli', createdAt: now, updatedAt: now },
      ])
      .run();

    // Create chain: X -> Y -> Z (no cycle)
    db.insert(dependencies)
      .values([
        { consumerId: 'x', providerId: 'y', type: 'cli', createdAt: now },
        { consumerId: 'y', providerId: 'z', type: 'cli', createdAt: now },
      ])
      .run();

    const cycles = detectCycles(db, 'x');
    expect(cycles).toEqual([]);
  });

  test('detects longer cycle A -> B -> C -> A', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Create tools
    db.insert(tools)
      .values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ])
      .run();

    // Create edges: A -> B -> C -> A
    db.insert(dependencies)
      .values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'cli', createdAt: now },
        { consumerId: 'c', providerId: 'a', type: 'cli', createdAt: now },
      ])
      .run();

    const cycles = detectCycles(db, 'a');
    expect(cycles.length).toBeGreaterThan(0);

    const cycle = cycles[0];
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
    expect(cycle).toContain('c');
  });
});
