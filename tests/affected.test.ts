/**
 * Tests for affected command (F-017)
 *
 * Tests cover:
 * - Empty graph returns empty
 * - Single tool with no dependents
 * - Chain pattern (A→B→C)
 * - Diamond pattern
 * - Direct vs transitive behavior
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, dependencies } from '../src/db';
import { DependencyGraph } from '../src/lib';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-affected-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('affected command', () => {
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

  describe('getTransitiveDependents', () => {
    test('returns empty for empty graph', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.nodeCount()).toBe(0);
      expect(graph.getTransitiveDependents('nonexistent')).toHaveLength(0);
    });

    test('returns empty for tool with no dependents', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'tool-a',
        name: 'Tool A',
        path: '/path/a',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const affected = graph.getTransitiveDependents('tool-a');

      expect(affected).toHaveLength(0);
    });

    test('returns direct dependents', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A <- B (B depends on A)
      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/path/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/path/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'tool-b',
        providerId: 'tool-a',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const affected = graph.getTransitiveDependents('tool-a');

      expect(affected).toHaveLength(1);
      expect(affected[0]!.id).toBe('tool-b');
    });

    test('returns transitive chain (A <- B <- C)', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A <- B <- C (C depends on B, B depends on A)
      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/path/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/path/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-c', name: 'Tool C', path: '/path/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'tool-b', providerId: 'tool-a', type: 'runtime', createdAt: now },
        { consumerId: 'tool-c', providerId: 'tool-b', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const affected = graph.getTransitiveDependents('tool-a');

      expect(affected).toHaveLength(2);
      const ids = affected.map((n) => n.id).sort();
      expect(ids).toEqual(['tool-b', 'tool-c']);
    });

    test('handles diamond pattern', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Diamond: A <- B, A <- C, B <- D, C <- D
      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/path/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/path/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-c', name: 'Tool C', path: '/path/c', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-d', name: 'Tool D', path: '/path/d', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'tool-b', providerId: 'tool-a', type: 'runtime', createdAt: now },
        { consumerId: 'tool-c', providerId: 'tool-a', type: 'runtime', createdAt: now },
        { consumerId: 'tool-d', providerId: 'tool-b', type: 'runtime', createdAt: now },
        { consumerId: 'tool-d', providerId: 'tool-c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const affected = graph.getTransitiveDependents('tool-a');

      expect(affected).toHaveLength(3);
      const ids = affected.map((n) => n.id).sort();
      expect(ids).toEqual(['tool-b', 'tool-c', 'tool-d']);
    });

    test('getDependents returns only direct dependents', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A <- B <- C
      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/path/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/path/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-c', name: 'Tool C', path: '/path/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'tool-b', providerId: 'tool-a', type: 'runtime', createdAt: now },
        { consumerId: 'tool-c', providerId: 'tool-b', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const direct = graph.getDependents('tool-a');

      // Direct should only return B, not C
      expect(direct).toHaveLength(1);
      expect(direct[0]!.id).toBe('tool-b');
    });

    test('returns empty for unknown tool', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'tool-a',
        name: 'Tool A',
        path: '/path/a',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const affected = graph.getTransitiveDependents('nonexistent');

      expect(affected).toHaveLength(0);
    });
  });
});
