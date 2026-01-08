/**
 * Tests for blast-radius command (F-018)
 *
 * Tests cover:
 * - Empty blast radius (no dependents)
 * - Single-depth blast radius
 * - Multi-depth blast radius
 * - Risk score calculation
 * - Critical tool detection (MCP)
 * - JSON output format
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, dependencies } from '../src/db';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-blast-radius-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('blast-radius', () => {
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

  describe('impact analysis', () => {
    test('empty blast radius for isolated tool', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create isolated tool (no dependents)
      db.insert(tools).values({
        id: 'isolated',
        name: 'Isolated Tool',
        path: '/path/isolated',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      // Run blast-radius command
      const result = await runBlastRadius('isolated');

      expect(result.success).toBe(true);
      expect(result.analysis?.impact.totalCount).toBe(0);
      expect(result.analysis?.risk.level).toBe('LOW');
      expect(result.analysis?.risk.score).toBe(0);
    });

    test('single-depth blast radius', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create tools
      db.insert(tools).values([
        { id: 'core', name: 'Core', path: '/path/core', type: 'library', createdAt: now, updatedAt: now },
        { id: 'app1', name: 'App 1', path: '/path/app1', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'app2', name: 'App 2', path: '/path/app2', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      // Create dependencies: app1 and app2 depend on core
      db.insert(dependencies).values([
        { consumerId: 'app1', providerId: 'core', type: 'library', createdAt: now },
        { consumerId: 'app2', providerId: 'core', type: 'library', createdAt: now },
      ]).run();

      const result = await runBlastRadius('core');

      expect(result.success).toBe(true);
      expect(result.analysis?.impact.totalCount).toBe(2);
      expect(result.analysis?.impact.directCount).toBe(2);
      expect(result.analysis?.impact.transitiveCount).toBe(0);
      expect(result.analysis?.impact.maxDepth).toBe(1);
    });

    test('multi-depth blast radius', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create chain: core -> service -> api -> frontend
      db.insert(tools).values([
        { id: 'core', name: 'Core', path: '/path/core', type: 'library', createdAt: now, updatedAt: now },
        { id: 'service', name: 'Service', path: '/path/service', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'api', name: 'API', path: '/path/api', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'frontend', name: 'Frontend', path: '/path/frontend', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'service', providerId: 'core', type: 'library', createdAt: now },
        { consumerId: 'api', providerId: 'service', type: 'cli', createdAt: now },
        { consumerId: 'frontend', providerId: 'api', type: 'cli', createdAt: now },
      ]).run();

      const result = await runBlastRadius('core');

      expect(result.success).toBe(true);
      expect(result.analysis?.impact.totalCount).toBe(3);
      expect(result.analysis?.impact.directCount).toBe(1);
      expect(result.analysis?.impact.transitiveCount).toBe(2);
      expect(result.analysis?.impact.maxDepth).toBe(3);

      // Check depth distribution
      const depths = result.analysis?.byDepth;
      expect(depths).toBeDefined();
      expect(depths?.find((d) => d.depth === 1)?.count).toBe(1);
      expect(depths?.find((d) => d.depth === 2)?.count).toBe(1);
      expect(depths?.find((d) => d.depth === 3)?.count).toBe(1);
    });
  });

  describe('risk assessment', () => {
    test('calculates risk score based on affected count', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create core with many dependents
      db.insert(tools).values([
        { id: 'core', name: 'Core', path: '/path/core', type: 'library', createdAt: now, updatedAt: now },
        { id: 'app1', name: 'App 1', path: '/path/app1', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'app2', name: 'App 2', path: '/path/app2', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'app3', name: 'App 3', path: '/path/app3', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'app4', name: 'App 4', path: '/path/app4', type: 'cli', createdAt: now, updatedAt: now },
        { id: 'app5', name: 'App 5', path: '/path/app5', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      for (let i = 1; i <= 5; i++) {
        db.insert(dependencies).values({
          consumerId: `app${i}`,
          providerId: 'core',
          type: 'library',
          createdAt: now,
        }).run();
      }

      const result = await runBlastRadius('core');

      expect(result.success).toBe(true);
      expect(result.analysis?.risk.score).toBeGreaterThan(0);
      // 5 tools affected, low debt = should be LOW to MEDIUM risk
      expect(['LOW', 'MEDIUM']).toContain(result.analysis?.risk.level);
    });

    test('higher debt increases risk score', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create core with high-debt dependents
      db.insert(tools).values([
        { id: 'core', name: 'Core', path: '/path/core', type: 'library', createdAt: now, updatedAt: now },
        { id: 'high-debt', name: 'High Debt', path: '/path/hd', type: 'cli', debtScore: 50, createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'high-debt',
        providerId: 'core',
        type: 'library',
        createdAt: now,
      }).run();

      const result = await runBlastRadius('core');

      expect(result.success).toBe(true);
      expect(result.analysis?.risk.avgDebtScore).toBe(50);
      // High debt should increase the risk score
      expect(result.analysis?.risk.score).toBeGreaterThan(1);
    });

    test('identifies critical MCP tools', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create core with MCP dependents
      db.insert(tools).values([
        { id: 'core', name: 'Core', path: '/path/core', type: 'library', createdAt: now, updatedAt: now },
        { id: 'mcp-tool', name: 'MCP Tool', path: '/path/mcp', type: 'mcp', createdAt: now, updatedAt: now },
        { id: 'cli-tool', name: 'CLI Tool', path: '/path/cli', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values([
        { consumerId: 'mcp-tool', providerId: 'core', type: 'library', createdAt: now },
        { consumerId: 'cli-tool', providerId: 'core', type: 'library', createdAt: now },
      ]).run();

      const result = await runBlastRadius('core');

      expect(result.success).toBe(true);
      expect(result.analysis?.risk.criticalCount).toBe(1);

      // Check type impacts
      const mcpImpact = result.analysis?.byType.find((t) => t.type === 'mcp');
      expect(mcpImpact?.critical).toBe(true);
      expect(mcpImpact?.count).toBe(1);
    });
  });

  describe('rollback strategy', () => {
    test('generates strategy for MCP tools first', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'core', name: 'Core', path: '/path/core', type: 'library', createdAt: now, updatedAt: now },
        { id: 'mcp-tool', name: 'MCP Tool', path: '/path/mcp', type: 'mcp', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'mcp-tool',
        providerId: 'core',
        type: 'library',
        createdAt: now,
      }).run();

      const result = await runBlastRadius('core');

      expect(result.success).toBe(true);
      expect(result.analysis?.rollbackStrategy.length).toBeGreaterThan(0);
      // Should mention MCP tools first
      const mcpStep = result.analysis?.rollbackStrategy.find((s) => s.includes('MCP'));
      expect(mcpStep).toBeDefined();
    });
  });

  describe('JSON output', () => {
    test('returns complete analysis in JSON format', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools).values([
        { id: 'core', name: 'Core', path: '/path/core', type: 'library', createdAt: now, updatedAt: now },
        { id: 'app', name: 'App', path: '/path/app', type: 'cli', createdAt: now, updatedAt: now },
      ]).run();

      db.insert(dependencies).values({
        consumerId: 'app',
        providerId: 'core',
        type: 'library',
        createdAt: now,
      }).run();

      const result = await runBlastRadius('core');

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.tool).toBe('core');
      expect(result.analysis?.impact).toBeDefined();
      expect(result.analysis?.risk).toBeDefined();
      expect(result.analysis?.byType).toBeDefined();
      expect(result.analysis?.byDepth).toBeDefined();
      expect(result.analysis?.affectedTools).toBeDefined();
      expect(result.analysis?.rollbackStrategy).toBeDefined();
    });

    test('returns error for non-existent tool', async () => {
      // Don't create any tools
      getDb();

      const result = await runBlastRadius('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});

/**
 * Helper to run blast-radius command and parse JSON output
 */
async function runBlastRadius(toolId: string): Promise<{
  success: boolean;
  error?: string;
  analysis?: {
    tool: string;
    impact: {
      directCount: number;
      transitiveCount: number;
      totalCount: number;
      maxDepth: number;
    };
    risk: {
      score: number;
      level: string;
      chainReliability: number;
      avgDebtScore: number;
      criticalCount: number;
    };
    byType: Array<{ type: string; count: number; critical: boolean }>;
    byDepth: Array<{ depth: number; count: number }>;
    affectedTools: Array<{
      id: string;
      name: string;
      type: string;
      reliability: number;
      debtScore: number;
      depth: number;
    }>;
    rollbackStrategy: string[];
  };
}> {
  const proc = Bun.spawn(['bun', 'run', 'src/index.ts', '--json', 'blast-radius', toolId], {
    cwd: '/Users/fischer/work/pai-deps',
    env: { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    return JSON.parse(stdout);
  } catch {
    return { success: false, error: `Failed to parse output: ${stdout}` };
  }
}
