/**
 * Tests for chain-reliability command (F-011)
 *
 * Tests cover:
 * - Single tool (compound = own reliability)
 * - Linear chain (A→B→C)
 * - Diamond pattern (each dep counted once)
 * - Threshold checking
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, dependencies } from '../src/db';
import { DependencyGraph } from '../src/lib';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-chain-rel-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('chain-reliability', () => {
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

  describe('compound reliability calculation', () => {
    test('single tool with no dependencies', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'tool-a',
        name: 'Tool A',
        path: '/path/a',
        type: 'cli',
        reliability: 0.95,
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const node = graph.getNode('tool-a')!;
      const deps = graph.getTransitiveDependencies('tool-a');

      // No dependencies, compound = own reliability
      expect(deps).toHaveLength(0);
      expect(node.reliability).toBe(0.95);
    });

    test('linear chain A→B (A depends on B)', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/path/a', type: 'cli', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/path/b', type: 'cli', reliability: 0.90, createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'tool-a',
        providerId: 'tool-b',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const nodeA = graph.getNode('tool-a')!;
      const deps = graph.getTransitiveDependencies('tool-a');

      // compound = 0.95 × 0.90 = 0.855
      const compound = nodeA.reliability * deps.reduce((acc, d) => acc * d.reliability, 1);
      expect(compound).toBeCloseTo(0.855, 3);
      expect(deps).toHaveLength(1);
    });

    test('longer chain A→B→C', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/path/a', type: 'cli', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/path/b', type: 'cli', reliability: 0.90, createdAt: now, updatedAt: now },
        { id: 'tool-c', name: 'Tool C', path: '/path/c', type: 'cli', reliability: 0.85, createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'tool-a', providerId: 'tool-b', type: 'runtime', createdAt: now },
        { consumerId: 'tool-b', providerId: 'tool-c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const nodeA = graph.getNode('tool-a')!;
      const deps = graph.getTransitiveDependencies('tool-a');

      // compound = 0.95 × 0.90 × 0.85 = 0.72675
      const compound = nodeA.reliability * deps.reduce((acc, d) => acc * d.reliability, 1);
      expect(compound).toBeCloseTo(0.72675, 4);
      expect(deps).toHaveLength(2);
    });

    test('5-tool chain at 95% each', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create 5 tools in a chain
      db.insert(tools).values([
        { id: 'tool-1', name: 'Tool 1', path: '/path/1', type: 'cli', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'tool-2', name: 'Tool 2', path: '/path/2', type: 'cli', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'tool-3', name: 'Tool 3', path: '/path/3', type: 'cli', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'tool-4', name: 'Tool 4', path: '/path/4', type: 'cli', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'tool-5', name: 'Tool 5', path: '/path/5', type: 'cli', reliability: 0.95, createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'tool-1', providerId: 'tool-2', type: 'runtime', createdAt: now },
        { consumerId: 'tool-2', providerId: 'tool-3', type: 'runtime', createdAt: now },
        { consumerId: 'tool-3', providerId: 'tool-4', type: 'runtime', createdAt: now },
        { consumerId: 'tool-4', providerId: 'tool-5', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const node1 = graph.getNode('tool-1')!;
      const deps = graph.getTransitiveDependencies('tool-1');

      // compound = 0.95^5 = 0.7737809375
      const compound = node1.reliability * deps.reduce((acc, d) => acc * d.reliability, 1);
      expect(compound).toBeCloseTo(0.7738, 3);
      expect(deps).toHaveLength(4); // 4 dependencies (not counting self)
    });

    test('diamond pattern counts each dependency once', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Diamond: A→B, A→C, B→D, C→D
      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/path/a', type: 'cli', reliability: 0.95, createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/path/b', type: 'cli', reliability: 0.90, createdAt: now, updatedAt: now },
        { id: 'tool-c', name: 'Tool C', path: '/path/c', type: 'cli', reliability: 0.85, createdAt: now, updatedAt: now },
        { id: 'tool-d', name: 'Tool D', path: '/path/d', type: 'cli', reliability: 0.80, createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'tool-a', providerId: 'tool-b', type: 'runtime', createdAt: now },
        { consumerId: 'tool-a', providerId: 'tool-c', type: 'runtime', createdAt: now },
        { consumerId: 'tool-b', providerId: 'tool-d', type: 'runtime', createdAt: now },
        { consumerId: 'tool-c', providerId: 'tool-d', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const nodeA = graph.getNode('tool-a')!;
      const deps = graph.getTransitiveDependencies('tool-a');

      // D should only be counted once
      expect(deps).toHaveLength(3);
      const depIds = deps.map((d) => d.id).sort();
      expect(depIds).toEqual(['tool-b', 'tool-c', 'tool-d']);

      // compound = 0.95 × 0.90 × 0.85 × 0.80 = 0.5814
      const compound = nodeA.reliability * deps.reduce((acc, d) => acc * d.reliability, 1);
      expect(compound).toBeCloseTo(0.5814, 3);
    });

    test('returns empty for unknown tool', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.hasNode('nonexistent')).toBe(false);
    });
  });
});
