/**
 * Tests for pai-deps rdeps command (F-009)
 *
 * Tests reverse dependency queries (what depends on a tool)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, dependencies } from '../src/db';
import { DependencyGraph } from '../src/lib';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-rdeps-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('rdeps command - DependencyGraph integration', () => {
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

  describe('getDependents (direct)', () => {
    test('returns empty array for tool with no dependents', async () => {
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
      const deps = graph.getDependents('standalone');

      expect(deps).toEqual([]);
    });

    test('returns direct dependents only', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert tools: A -> B -> C (means A depends on B, B depends on C)
      // For rdeps on C: should return B (not A)
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
      const deps = graph.getDependents('c');

      expect(deps.length).toBe(1);
      expect(deps[0]!.id).toBe('b');
    });

    test('returns multiple direct dependents', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert tools: [B, C, D] all depend on A
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'library', path: '/a', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', reliability: 0.90, createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'mcp', path: '/c', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'cli', path: '/d', reliability: 0.99, createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'b', providerId: 'a', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'a', type: 'library', createdAt: now },
        { consumerId: 'd', providerId: 'a', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependents('a');

      expect(deps.length).toBe(3);
      const ids = deps.map(d => d.id).sort();
      expect(ids).toEqual(['b', 'c', 'd']);
    });

    test('returns empty array for unknown tool', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependents('nonexistent');

      expect(deps).toEqual([]);
    });
  });

  describe('transitive dependents', () => {
    test('returns all tools that depend on target (transitively)', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert tools: D -> C -> B -> A (A is foundational)
      // rdeps on A should return: B (depth 1), C (depth 2), D (depth 3)
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'library', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'cli', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'cli', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'b', providerId: 'a', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'd', providerId: 'c', type: 'cli', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);

      // Helper to get transitive dependents with depth
      function getTransitiveDependents(startId: string): Map<string, number> {
        const depths = new Map<string, number>();
        const queue: [string, number][] = [];

        for (const dep of graph.getDependents(startId)) {
          queue.push([dep.id, 1]);
          depths.set(dep.id, 1);
        }

        while (queue.length > 0) {
          const [current, depth] = queue.shift()!;
          for (const next of graph.getDependents(current)) {
            if (!depths.has(next.id)) {
              depths.set(next.id, depth + 1);
              queue.push([next.id, depth + 1]);
            }
          }
        }

        return depths;
      }

      const depths = getTransitiveDependents('a');
      expect(depths.size).toBe(3);
      expect(depths.get('b')).toBe(1);
      expect(depths.get('c')).toBe(2);
      expect(depths.get('d')).toBe(3);
    });

    test('handles diamond dependents', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // D depends on both B and C, both B and C depend on A
      // A <- [B, C] <- D
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'library', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'cli', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'cli', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'b', providerId: 'a', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'a', type: 'library', createdAt: now },
        { consumerId: 'd', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'd', providerId: 'c', type: 'cli', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);

      // Helper to get transitive dependents
      function getTransitiveDependents(startId: string): Map<string, number> {
        const depths = new Map<string, number>();
        const queue: [string, number][] = [];

        for (const dep of graph.getDependents(startId)) {
          queue.push([dep.id, 1]);
          depths.set(dep.id, 1);
        }

        while (queue.length > 0) {
          const [current, depth] = queue.shift()!;
          for (const next of graph.getDependents(current)) {
            if (!depths.has(next.id)) {
              depths.set(next.id, depth + 1);
              queue.push([next.id, depth + 1]);
            }
          }
        }

        return depths;
      }

      const depths = getTransitiveDependents('a');
      expect(depths.size).toBe(3);
      expect(depths.get('b')).toBe(1);
      expect(depths.get('c')).toBe(1);
      expect(depths.get('d')).toBe(2); // minimum depth via either path
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

      // Helper to get transitive dependents (excludes start node)
      function getTransitiveDependents(startId: string): Map<string, number> {
        const depths = new Map<string, number>();
        const queue: [string, number][] = [];

        for (const dep of graph.getDependents(startId)) {
          queue.push([dep.id, 1]);
          depths.set(dep.id, 1);
        }

        while (queue.length > 0) {
          const [current, depth] = queue.shift()!;
          for (const next of graph.getDependents(current)) {
            // Exclude start node from results (handles cycles)
            if (next.id !== startId && !depths.has(next.id)) {
              depths.set(next.id, depth + 1);
              queue.push([next.id, depth + 1]);
            }
          }
        }

        return depths;
      }

      // Should not hang - BFS handles cycles
      const deps = getTransitiveDependents('a');
      expect(deps.size).toBe(2); // b and c (not a itself)
    });
  });

  describe('depth limiting', () => {
    test('respects max depth parameter', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // D -> C -> B -> A (chain of depth 3)
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'library', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'cli', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'cli', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'cli', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'b', providerId: 'a', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'b', type: 'cli', createdAt: now },
        { consumerId: 'd', providerId: 'c', type: 'cli', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);

      // Helper with depth limit
      function getTransitiveDependentsWithLimit(
        startId: string,
        maxDepth: number
      ): Map<string, number> {
        const depths = new Map<string, number>();
        const queue: [string, number][] = [];

        for (const dep of graph.getDependents(startId)) {
          queue.push([dep.id, 1]);
          depths.set(dep.id, 1);
        }

        while (queue.length > 0) {
          const [current, depth] = queue.shift()!;
          if (depth >= maxDepth) continue;

          for (const next of graph.getDependents(current)) {
            if (!depths.has(next.id)) {
              depths.set(next.id, depth + 1);
              queue.push([next.id, depth + 1]);
            }
          }
        }

        return depths;
      }

      // Limit to depth 1: should only get B
      const depth1 = getTransitiveDependentsWithLimit('a', 1);
      expect(depth1.size).toBe(1);
      expect(depth1.has('b')).toBe(true);

      // Limit to depth 2: should get B and C
      const depth2 = getTransitiveDependentsWithLimit('a', 2);
      expect(depth2.size).toBe(2);
      expect(depth2.has('b')).toBe(true);
      expect(depth2.has('c')).toBe(true);
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
          type: 'library',
          path: '/a',
          reliability: 0.95,
          debtScore: 3,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'b',
          name: 'Tool B',
          type: 'cli',
          path: '/b',
          reliability: 0.90,
          debtScore: 5,
          createdAt: now,
          updatedAt: now,
        },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'b', providerId: 'a', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependents('a');

      expect(deps.length).toBe(1);
      const dep = deps[0]!;
      expect(dep.id).toBe('b');
      expect(dep.name).toBe('Tool B');
      expect(dep.type).toBe('cli');
      expect(dep.reliability).toBe(0.90);
      expect(dep.debtScore).toBe(5);
      expect(dep.stub).toBe(false);
    });
  });
});
