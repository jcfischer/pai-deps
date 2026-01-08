/**
 * Tests for pai-deps DOT graph generation (F-012)
 *
 * Tests DOT graph generation functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, dependencies } from '../src/db';
import { DependencyGraph } from '../src/lib';
import { generateDot } from '../src/lib/dot';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-dot-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('DOT generation (F-012)', () => {
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

  describe('generateDot', () => {
    test('generates valid DOT header', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'test-tool',
        name: 'Test Tool',
        type: 'cli',
        path: '/test',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph);

      expect(dot).toContain('digraph pai_deps {');
      expect(dot).toContain('rankdir=LR;');
      expect(dot).toContain('}');
    });

    test('generates node declarations with correct styling', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'cli-tool', name: 'CLI Tool', type: 'cli', path: '/cli', createdAt: now, updatedAt: now },
        { id: 'lib-tool', name: 'Lib Tool', type: 'library', path: '/lib', createdAt: now, updatedAt: now },
        { id: 'mcp-tool', name: 'MCP Tool', type: 'mcp', path: '/mcp', createdAt: now, updatedAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph);

      // CLI tools should have green fill
      expect(dot).toContain('fillcolor="#e8f5e9"');
      // Library tools should have blue fill
      expect(dot).toContain('fillcolor="#e1f5fe"');
      // MCP tools should have purple fill
      expect(dot).toContain('fillcolor="#f3e5f5"');
    });

    test('generates edge declarations', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph);

      expect(dot).toContain('a -> b;');
    });

    test('handles empty graph', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph);

      expect(dot).toContain('digraph pai_deps {');
      expect(dot).toContain('// Empty graph');
      expect(dot).toContain('}');
    });

    test('escapes special characters in IDs', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'my-tool',
        name: 'My Tool',
        type: 'cli',
        path: '/test',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph);

      // Hyphens should be replaced with underscores in DOT IDs
      expect(dot).toContain('my_tool');
    });

    test('styles stub nodes with dashed border', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'stub-tool',
        name: 'Stub Tool',
        type: 'library',
        path: '/stub',
        stub: 1,
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph);

      expect(dot).toContain('style="filled,dashed"');
      expect(dot).toContain('fillcolor="#eeeeee"');
    });

    test('disables colors when noColor option is set', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'test-tool',
        name: 'Test Tool',
        type: 'cli',
        path: '/test',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph, { noColor: true });

      expect(dot).toContain('fillcolor="#ffffff"');
    });
  });

  describe('focus subgraph', () => {
    test('generates subgraph centered on focus tool', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create A -> B -> C chain
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'cli', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph, { focusId: 'b', maxDepth: 1 });

      // Should include b and its direct neighbors (a and c)
      expect(dot).toContain('Tool A');
      expect(dot).toContain('Tool B');
      expect(dot).toContain('Tool C');
      // Should NOT include d (unconnected)
      expect(dot).not.toContain('Tool D');
    });

    test('highlights focus node with bold border', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'focus-tool', name: 'Focus Tool', type: 'cli', path: '/focus', createdAt: now, updatedAt: now },
        { id: 'other-tool', name: 'Other Tool', type: 'library', path: '/other', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'focus-tool', providerId: 'other-tool', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph, { focusId: 'focus-tool', maxDepth: 1 });

      // Focus node should have penwidth=2 and peripheries=2
      expect(dot).toMatch(/focus_tool.*penwidth=2.*peripheries=2/);
    });

    test('throws error for non-existent focus tool', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(() => {
        generateDot(graph, { focusId: 'nonexistent' });
      }).toThrow("Tool 'nonexistent' not found");
    });

    test('respects depth limit', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create A -> B -> C -> D chain
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'library', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph, { focusId: 'b', maxDepth: 1 });

      // With depth 1 from b: should include a, b, c but not d
      expect(dot).toContain('Tool A');
      expect(dot).toContain('Tool B');
      expect(dot).toContain('Tool C');
      expect(dot).not.toContain('Tool D');
    });
  });

  describe('circular dependency detection', () => {
    test('marks circular edges with red dashed style', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create A <-> B circular dependency
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
        { consumerId: 'b', providerId: 'a', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const dot = generateDot(graph);

      // Both edges should be marked as circular
      expect(dot).toContain('[color="red" style="dashed"]');
    });
  });
});
