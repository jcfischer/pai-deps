/**
 * Tests for pai-deps path and allpaths commands (F-010)
 *
 * Tests path finding functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, dependencies } from '../src/db';
import { DependencyGraph } from '../src/lib';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-path-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('path queries (F-010)', () => {
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

  describe('findPath (shortest path)', () => {
    test('finds direct path', async () => {
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
      const path = graph.findPath('a', 'b');

      expect(path).toEqual(['a', 'b']);
    });

    test('finds transitive path', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const path = graph.findPath('a', 'c');

      expect(path).toEqual(['a', 'b', 'c']);
    });

    test('returns null when no path exists', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B, C (isolated)
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const path = graph.findPath('a', 'c');

      expect(path).toBeNull();
    });

    test('returns null for reverse direction (no back-edges)', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B (forward only)
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const path = graph.findPath('b', 'a');

      expect(path).toBeNull();
    });

    test('finds shortest path in diamond graph', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> D
      // A -> C -> D
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'library', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
        { consumerId: 'a', providerId: 'c', type: 'library', createdAt: now },
        { consumerId: 'b', providerId: 'd', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const path = graph.findPath('a', 'd');

      // Both paths have same length, either is valid
      expect(path?.length).toBe(3);
      expect(path?.[0]).toBe('a');
      expect(path?.[2]).toBe('d');
    });

    test('returns null for non-existent source', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);
      const path = graph.findPath('nonexistent', 'also-nonexistent');

      expect(path).toBeNull();
    });
  });

  describe('findAllPaths', () => {
    test('finds single path', async () => {
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
      const paths = graph.findAllPaths('a', 'b');

      expect(paths.length).toBe(1);
      expect(paths[0]).toEqual(['a', 'b']);
    });

    test('finds multiple paths in diamond graph', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> D
      // A -> C -> D
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'library', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
        { consumerId: 'a', providerId: 'c', type: 'library', createdAt: now },
        { consumerId: 'b', providerId: 'd', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const paths = graph.findAllPaths('a', 'd');

      expect(paths.length).toBe(2);
      // Both paths should be length 3
      expect(paths.every((p) => p.length === 3)).toBe(true);
      // All paths start with a and end with d
      expect(paths.every((p) => p[0] === 'a' && p[2] === 'd')).toBe(true);
    });

    test('returns empty array when no path exists', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const paths = graph.findAllPaths('a', 'b');

      expect(paths).toEqual([]);
    });

    test('respects max paths limit', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create a graph with many paths
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b1', name: 'Tool B1', type: 'library', path: '/b1', createdAt: now, updatedAt: now },
        { id: 'b2', name: 'Tool B2', type: 'library', path: '/b2', createdAt: now, updatedAt: now },
        { id: 'b3', name: 'Tool B3', type: 'library', path: '/b3', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b1', type: 'library', createdAt: now },
        { consumerId: 'a', providerId: 'b2', type: 'library', createdAt: now },
        { consumerId: 'a', providerId: 'b3', type: 'library', createdAt: now },
        { consumerId: 'b1', providerId: 'c', type: 'library', createdAt: now },
        { consumerId: 'b2', providerId: 'c', type: 'library', createdAt: now },
        { consumerId: 'b3', providerId: 'c', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const paths = graph.findAllPaths('a', 'c', 2);

      expect(paths.length).toBe(2);
    });

    test('handles circular dependencies', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C -> A (cycle) and B -> D
      db.insert(tools).values([
        { id: 'a', name: 'Tool A', type: 'cli', path: '/a', createdAt: now, updatedAt: now },
        { id: 'b', name: 'Tool B', type: 'library', path: '/b', createdAt: now, updatedAt: now },
        { id: 'c', name: 'Tool C', type: 'library', path: '/c', createdAt: now, updatedAt: now },
        { id: 'd', name: 'Tool D', type: 'library', path: '/d', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'library', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'library', createdAt: now },
        { consumerId: 'c', providerId: 'a', type: 'library', createdAt: now },
        { consumerId: 'b', providerId: 'd', type: 'library', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);

      // Should find path to d without getting stuck in cycle
      const paths = graph.findAllPaths('a', 'd');
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]).toEqual(['a', 'b', 'd']);
    });
  });
});
