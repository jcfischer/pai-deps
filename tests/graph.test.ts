/**
 * Tests for the in-memory dependency graph (F-007)
 *
 * Tests cover:
 * - Loading graph from database
 * - Node and edge access
 * - Direct dependencies and dependents
 * - Transitive dependencies and dependents
 * - Path finding (shortest and all paths)
 * - Cycle detection
 * - Topological sort
 * - JSON serialization
 * - Empty database handling
 * - Dangling reference handling
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, dependencies } from '../src/db';
import { DependencyGraph, type ToolNode } from '../src/lib';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-graph-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('DependencyGraph', () => {
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

  // ========== Loading Tests ==========

  describe('loading', () => {
    test('loads empty database without error', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.nodeCount()).toBe(0);
      expect(graph.edgeCount()).toBe(0);
    });

    test('loads tools as nodes', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/b', type: 'mcp', createdAt: now, updatedAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);

      expect(graph.nodeCount()).toBe(2);
      expect(graph.hasNode('tool-a')).toBe(true);
      expect(graph.hasNode('tool-b')).toBe(true);
    });

    test('loads dependencies as edges', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'tool-a',
        providerId: 'tool-b',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);

      expect(graph.edgeCount()).toBe(1);
      const edge = graph.getEdge('tool-a', 'tool-b');
      expect(edge).toBeDefined();
      expect(edge?.from).toBe('tool-a');
      expect(edge?.to).toBe('tool-b');
    });

    test('maps node properties correctly', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'full-tool',
        name: 'Full Tool',
        path: '/full',
        type: 'mcp',
        version: '1.2.3',
        reliability: 0.85,
        debtScore: 5,
        stub: 1,
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const node = graph.getNode('full-tool');

      expect(node).toBeDefined();
      expect(node?.id).toBe('full-tool');
      expect(node?.name).toBe('Full Tool');
      expect(node?.type).toBe('mcp');
      expect(node?.version).toBe('1.2.3');
      expect(node?.reliability).toBe(0.85);
      expect(node?.debtScore).toBe(5);
      expect(node?.stub).toBe(true);
    });

    test('maps edge properties correctly', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'tool-a', name: 'Tool A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'tool-b', name: 'Tool B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'tool-a',
        providerId: 'tool-b',
        type: 'optional',
        versionConstraint: '^1.0.0',
        optional: 1,
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const edge = graph.getEdge('tool-a', 'tool-b');

      expect(edge).toBeDefined();
      expect(edge?.type).toBe('optional');
      expect(edge?.version).toBe('^1.0.0');
      expect(edge?.optional).toBe(true);
    });
  });

  // ========== Node/Edge Access Tests ==========

  describe('node access', () => {
    test('getNode returns node for existing ID', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'test-tool',
        name: 'Test',
        path: '/test',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const node = graph.getNode('test-tool');

      expect(node).toBeDefined();
      expect(node?.name).toBe('Test');
    });

    test('getNode returns undefined for unknown ID', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.getNode('nonexistent')).toBeUndefined();
    });

    test('getAllNodes returns all nodes', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const nodes = graph.getAllNodes();

      expect(nodes).toHaveLength(3);
      const ids = nodes.map(n => n.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });

    test('hasNode returns correct boolean', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'exists',
        name: 'Exists',
        path: '/exists',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);

      expect(graph.hasNode('exists')).toBe(true);
      expect(graph.hasNode('not-exists')).toBe(false);
    });
  });

  describe('edge access', () => {
    test('getEdge returns edge for existing pair', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'a',
        providerId: 'b',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);

      expect(graph.getEdge('a', 'b')).toBeDefined();
      expect(graph.getEdge('b', 'a')).toBeUndefined(); // Direction matters
    });

    test('getAllEdges returns all edges', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const edges = graph.getAllEdges();

      expect(edges).toHaveLength(2);
    });
  });

  // ========== Dependency Query Tests ==========

  describe('dependencies', () => {
    test('getDependencies returns direct dependencies', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C (A depends on B, B depends on C)
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const deps = graph.getDependencies('a');

      expect(deps).toHaveLength(1);
      expect(deps[0]?.id).toBe('b');
    });

    test('getDependencies returns empty array for unknown node', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.getDependencies('nonexistent')).toEqual([]);
    });

    test('getDependencyEdges returns edges', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'a',
        providerId: 'b',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const edges = graph.getDependencyEdges('a');

      expect(edges).toHaveLength(1);
      expect(edges[0]?.from).toBe('a');
      expect(edges[0]?.to).toBe('b');
    });
  });

  describe('dependents', () => {
    test('getDependents returns direct dependents', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C (B has dependent A, provider C)
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const dependents = graph.getDependents('b');

      expect(dependents).toHaveLength(1);
      expect(dependents[0]?.id).toBe('a');
    });

    test('getDependents returns empty array for unknown node', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.getDependents('nonexistent')).toEqual([]);
    });

    test('getDependentEdges returns edges', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'a',
        providerId: 'b',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const edges = graph.getDependentEdges('b');

      expect(edges).toHaveLength(1);
      expect(edges[0]?.from).toBe('a');
      expect(edges[0]?.to).toBe('b');
    });
  });

  // ========== Transitive Query Tests ==========

  describe('transitive queries', () => {
    test('getTransitiveDependencies returns all reachable', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C -> D
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'd', name: 'D', path: '/d', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const transitive = graph.getTransitiveDependencies('a');
      const ids = transitive.map((n: ToolNode) => n.id).sort();

      expect(ids).toEqual(['b', 'c', 'd']);
    });

    test('getTransitiveDependencies returns empty for unknown node', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.getTransitiveDependencies('nonexistent')).toEqual([]);
    });

    test('getTransitiveDependents returns all depending', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C -> D (D has transitive dependents A, B, C)
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'd', name: 'D', path: '/d', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const transitive = graph.getTransitiveDependents('d');
      const ids = transitive.map((n: ToolNode) => n.id).sort();

      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  // ========== Path Finding Tests ==========

  describe('path finding', () => {
    test('findPath returns shortest path', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C and A -> D -> C (two paths, both length 2)
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'd', name: 'D', path: '/d', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
        { consumerId: 'a', providerId: 'd', type: 'runtime', createdAt: now },
        { consumerId: 'd', providerId: 'c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const path = graph.findPath('a', 'c');

      expect(path).toBeDefined();
      expect(path).toHaveLength(3);
      expect(path?.[0]).toBe('a');
      expect(path?.[2]).toBe('c');
    });

    test('findPath returns null for disconnected nodes', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();
      // No dependencies - nodes are disconnected

      const graph = await DependencyGraph.load(db);
      const path = graph.findPath('a', 'b');

      expect(path).toBeNull();
    });

    test('findPath returns [node] for same start and end', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'a',
        name: 'A',
        path: '/a',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const path = graph.findPath('a', 'a');

      expect(path).toEqual(['a']);
    });

    test('findPath returns null for unknown nodes', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.findPath('nonexistent', 'also-nonexistent')).toBeNull();
    });

    test('findAllPaths returns all paths', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> D and A -> C -> D (two paths to D)
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'd', name: 'D', path: '/d', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'd', type: 'runtime', createdAt: now },
        { consumerId: 'a', providerId: 'c', type: 'runtime', createdAt: now },
        { consumerId: 'c', providerId: 'd', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const paths = graph.findAllPaths('a', 'd');

      expect(paths).toHaveLength(2);
      for (const path of paths) {
        expect(path[0]).toBe('a');
        expect(path[path.length - 1]).toBe('d');
      }
    });

    test('findAllPaths returns empty for unknown nodes', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.findAllPaths('nonexistent', 'also-nonexistent')).toEqual([]);
    });
  });

  // ========== Cycle Detection Tests ==========

  describe('cycle detection', () => {
    test('findCycles detects simple cycle', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C -> A (cycle)
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
        { consumerId: 'c', providerId: 'a', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const cycles = graph.findCycles();

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('a');
      expect(cycles[0]).toContain('b');
      expect(cycles[0]).toContain('c');
    });

    test('findCycles returns empty for acyclic graph', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> C (no cycle)
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const cycles = graph.findCycles();

      expect(cycles).toHaveLength(0);
    });

    test('hasCycle returns correct boolean', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Simple cycle: A -> B -> A
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'a', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      expect(graph.hasCycle()).toBe(true);
    });

    test('findCycles handles self-loop', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> A (self-loop)
      db.insert(tools).values({
        id: 'a',
        name: 'A',
        path: '/a',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      db.insert(dependencies).values({
        consumerId: 'a',
        providerId: 'a',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const cycles = graph.findCycles();

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('a');
    });
  });

  // ========== Topological Sort Tests ==========

  describe('topological sort', () => {
    test('topologicalSort orders correctly', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A depends on B, B depends on C
      // Dependencies: A -> B -> C (arrows mean "depends on")
      // Build order: C first (no deps), then B, then A
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const sorted = graph.topologicalSort();

      // Dependencies should come before dependents in build order
      const aIdx = sorted.indexOf('a');
      const bIdx = sorted.indexOf('b');
      const cIdx = sorted.indexOf('c');

      // C has no dependencies, so it comes first
      // B depends on C, so B comes after C
      // A depends on B, so A comes after B
      expect(cIdx).toBeLessThan(bIdx); // C before B (B depends on C)
      expect(bIdx).toBeLessThan(aIdx); // B before A (A depends on B)
    });

    test('topologicalSort handles partial ordering with cycles', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A -> B -> A (cycle)
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'a', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const sorted = graph.topologicalSort();

      // With cycle, Kahn's algorithm returns partial ordering (nodes not in cycle)
      // Both A and B are in cycle and have in-degree > 0, so empty result
      expect(sorted).toHaveLength(0);
    });

    test('topologicalSort handles independent nodes', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // A, B, C with no dependencies
      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      const sorted = graph.topologicalSort();

      // All nodes should be included (any order is valid)
      expect(sorted).toHaveLength(3);
      expect(sorted.sort()).toEqual(['a', 'b', 'c']);
    });
  });

  // ========== Serialization Tests ==========

  describe('serialization', () => {
    test('toJSON produces valid structure', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'a',
        providerId: 'b',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const json = graph.toJSON();

      expect(json.nodes).toHaveLength(2);
      expect(json.edges).toHaveLength(1);
      expect(json.metadata.nodeCount).toBe(2);
      expect(json.metadata.edgeCount).toBe(1);
      expect(json.metadata.loadedAt).toBeDefined();

      // Verify it's valid JSON
      const str = JSON.stringify(json);
      const parsed = JSON.parse(str);
      expect(parsed.nodes).toHaveLength(2);
    });

    test('toJSON contains all node properties', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values({
        id: 'full-tool',
        name: 'Full Tool',
        path: '/full',
        type: 'mcp',
        version: '1.0.0',
        reliability: 0.9,
        debtScore: 3,
        stub: 1,
        createdAt: now,
        updatedAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const json = graph.toJSON();

      const node = json.nodes[0];
      expect(node?.id).toBe('full-tool');
      expect(node?.name).toBe('Full Tool');
      expect(node?.type).toBe('mcp');
      expect(node?.version).toBe('1.0.0');
      expect(node?.reliability).toBe(0.9);
      expect(node?.debtScore).toBe(3);
      expect(node?.stub).toBe(true);
    });

    test('toJSON contains all edge properties', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'a',
        providerId: 'b',
        type: 'optional',
        versionConstraint: '^2.0.0',
        optional: 1,
        createdAt: now,
      }).run();

      const graph = await DependencyGraph.load(db);
      const json = graph.toJSON();

      const edge = json.edges[0];
      expect(edge?.from).toBe('a');
      expect(edge?.to).toBe('b');
      expect(edge?.type).toBe('optional');
      expect(edge?.version).toBe('^2.0.0');
      expect(edge?.optional).toBe(true);
    });
  });

  // ========== Stats Tests ==========

  describe('stats', () => {
    test('nodeCount returns correct count', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      expect(graph.nodeCount()).toBe(3);
    });

    test('edgeCount returns correct count', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'c', name: 'C', path: '/c', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'a', providerId: 'b', type: 'runtime', createdAt: now },
        { consumerId: 'a', providerId: 'c', type: 'runtime', createdAt: now },
        { consumerId: 'b', providerId: 'c', type: 'runtime', createdAt: now },
      ]).run();

      const graph = await DependencyGraph.load(db);
      expect(graph.edgeCount()).toBe(3);
    });
  });

  // ========== Doctorow Gate Tests ==========

  describe('Doctorow Gate', () => {
    test('empty database produces empty graph (failure test)', async () => {
      const db = getDb();
      const graph = await DependencyGraph.load(db);

      expect(graph.nodeCount()).toBe(0);
      expect(graph.edgeCount()).toBe(0);
      expect(graph.getAllNodes()).toEqual([]);
      expect(graph.getAllEdges()).toEqual([]);
      expect(graph.findCycles()).toEqual([]);
      expect(graph.hasCycle()).toBe(false);
      expect(graph.topologicalSort()).toEqual([]);
    });

    test('handles 100+ tools performantly (assumption test)', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create 100 tools
      const toolRecords = [];
      for (let i = 0; i < 100; i++) {
        toolRecords.push({
          id: `tool-${i}`,
          name: `Tool ${i}`,
          path: `/path/${i}`,
          type: 'cli',
          createdAt: now,
          updatedAt: now,
        });
      }
      db.insert(tools).values(toolRecords).run();

      // Create chain: tool-0 -> tool-1 -> ... -> tool-99
      const depRecords = [];
      for (let i = 0; i < 99; i++) {
        depRecords.push({
          consumerId: `tool-${i}`,
          providerId: `tool-${i + 1}`,
          type: 'runtime',
          createdAt: now,
        });
      }
      db.insert(dependencies).values(depRecords).run();

      const start = performance.now();
      const graph = await DependencyGraph.load(db);
      const loadTime = performance.now() - start;

      expect(graph.nodeCount()).toBe(100);
      expect(graph.edgeCount()).toBe(99);
      expect(loadTime).toBeLessThan(100); // < 100ms

      // Test transitive dependencies
      const transitive = graph.getTransitiveDependencies('tool-0');
      expect(transitive).toHaveLength(99);
    });

    test('no external state - can recreate from DB (rollback test)', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'a', name: 'A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'b', name: 'B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'a',
        providerId: 'b',
        type: 'runtime',
        createdAt: now,
      }).run();

      const graph1 = await DependencyGraph.load(db);
      const graph2 = await DependencyGraph.load(db);

      // Both graphs should have identical data
      expect(graph1.nodeCount()).toBe(graph2.nodeCount());
      expect(graph1.edgeCount()).toBe(graph2.edgeCount());
      expect(graph1.toJSON().nodes.map((n: ToolNode) => n.id).sort())
        .toEqual(graph2.toJSON().nodes.map((n: ToolNode) => n.id).sort());
    });
  });
});
