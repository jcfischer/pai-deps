/**
 * Tests for pai-deps deps command (F-008)
 *
 * Tests forward dependency queries (what a tool depends on)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, dependencies } from '../src/db';
import { DependencyGraph } from '../src/lib';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-deps-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('deps command - DependencyGraph integration', () => {
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

  describe('getDependencies (direct)', () => {
    test('returns empty array for tool with no dependencies', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert standalone tool
      db.insert(tools).values({
        id: 'standalone',
        name: 'Standalone Tool',
        type: 'cli',
        path: '/path/to/standalone',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependencies('standalone');

      expect(deps).toEqual([]);
    });

    test('returns direct dependencies only', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert tools: A -> B -> C
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
      ]).run();

      // A depends on B, B depends on C
      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependencies('a');

      expect(deps.length).toBe(1);
      expect(deps[0]!.id).toBe('b');
    });

    test('returns multiple direct dependencies', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert tools: A -> [B, C, D]
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', reliability: 0.90, createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'mcp', path: '/c', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'library', path: '/d', reliability: 0.99, createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'a', providerId: 'c', type: 'mcp', createdAt: now },
        { consumerId: 'a', providerId: 'd', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependencies('a');

      expect(deps.length).toBe(3);
      const ids = deps.map(d => d.id).sort();
      expect(ids).toEqual(['b', 'c', 'd']);
    });

    test('returns empty array for unknown tool', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependencies('nonexistent');

      expect(deps).toEqual([]);
    });
  });

  describe('getTransitiveDependencies', () => {
    test('returns all reachable dependencies', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert tools: A -> B -> C -> D
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'library', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getTransitiveDependencies('a');

      expect(deps.length).toBe(3);
      const ids = deps.map(d => d.id).sort();
      expect(ids).toEqual(['b', 'c', 'd']);
    });

    test('handles diamond dependencies', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> [B, C] -> D (diamond pattern)
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'cli', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'library', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'a', providerId: 'c', type: 'cli', createdAt: now },
        { consumerId: 'b', providerId: 'd', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getTransitiveDependencies('a');

      expect(deps.length).toBe(3);
      const ids = deps.map(d => d.id).sort();
      expect(ids).toEqual(['b', 'c', 'd']);
    });

    test('handles circular dependencies without infinite loop', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C -> A (cycle)
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'cli', path: '/c', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'cli', createdAt: now },
        { consumerId: 'c', providerId: 'a', type: 'cli', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);

      // Should not hang - BFS handles cycles
      const deps = graph.getTransitiveDependencies('a');
      expect(deps.length).toBe(2); // b and c (not a itself)
    });
  });

  describe('depth calculation for transitive dependencies', () => {
    test('calculates correct depth for linear chain', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B (depth 1) -> C (depth 2) -> D (depth 3)
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'cli', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'cli', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'cli', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'cli', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);

      // Helper to calculate depths (BFS)
      function getTransitiveWithDepth(startId: string): Map<string, number> {
        const depths = new Map<string, number>();
        const queue: [string, number][] = [];

        for (const dep of graph.getDependencies(startId)) {
          queue.push([dep.id, 1]);
          depths.set(dep.id, 1);
        }

        while (queue.length > 0) {
          const [current, depth] = queue.shift()!;
          for (const next of graph.getDependencies(current)) {
            if (!depths.has(next.id)) {
              depths.set(next.id, depth + 1);
              queue.push([next.id, depth + 1]);
            }
          }
        }

        return depths;
      }

      const depths = getTransitiveWithDepth('a');
      expect(depths.get('b')).toBe(1);
      expect(depths.get('c')).toBe(2);
      expect(depths.get('d')).toBe(3);
    });

    test('uses minimum depth for diamond pattern', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B (depth 1) -> D (depth 2)
      // A -> C (depth 1) -> D (should be depth 2, not 1)
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'cli', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'cli', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'a', providerId: 'c', type: 'cli', createdAt: now },
        { consumerId: 'b', providerId: 'd', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);

      // Helper to calculate depths (BFS)
      function getTransitiveWithDepth(startId: string): Map<string, number> {
        const depths = new Map<string, number>();
        const queue: [string, number][] = [];

        for (const dep of graph.getDependencies(startId)) {
          queue.push([dep.id, 1]);
          depths.set(dep.id, 1);
        }

        while (queue.length > 0) {
          const [current, depth] = queue.shift()!;
          for (const next of graph.getDependencies(current)) {
            if (!depths.has(next.id)) {
              depths.set(next.id, depth + 1);
              queue.push([next.id, depth + 1]);
            }
          }
        }

        return depths;
      }

      const depths = getTransitiveWithDepth('a');
      expect(depths.get('b')).toBe(1);
      expect(depths.get('c')).toBe(1);
      expect(depths.get('d')).toBe(2);
    });
  });

  describe('tool metadata in results', () => {
    test('includes all required fields', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        {
          id: 'a',
          name: 'Tool A',
          type: 'cli',
          path: '/a',
          reliability: 0.95,
          debtScore: 3,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'b',
          name: 'Tool B',
          type: 'mcp',
          path: '/b',
          reliability: 0.90,
          debtScore: 5,
          createdAt: now,
          updatedAt: now,
        },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'mcp', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependencies('a');

      expect(deps.length).toBe(1);
      const dep = deps[0]!;
      expect(dep.id).toBe('b');
      expect(dep.name).toBe('Tool B');
      expect(dep.type).toBe('mcp');
      expect(dep.reliability).toBe(0.90);
      expect(dep.debtScore).toBe(5);
      expect(dep.stub).toBe(false);
    });
  });
});
