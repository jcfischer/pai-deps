/**
 * Tests for verify-history command (F-015)
 *
 * Tests cover:
 * - Verification history storage
 * - History query returns results
 * - Limit flag works
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { desc, eq } from 'drizzle-orm';
import { getDb, closeDb, resetDb, tools, toolVerifications } from '../src/db';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-verify-history-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('verify-history', () => {
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

  describe('tool_verifications table', () => {
    test('can insert verification record', () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create tool first
      db.insert(tools).values({
        id: 'tool-a',
        name: 'Tool A',
        path: '/path/a',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      // Insert verification
      db.insert(toolVerifications).values({
        toolId: 'tool-a',
        verifiedAt: now,
        overallStatus: 'pass',
        cliStatus: 'pass',
        cliPassed: 5,
        cliFailed: 0,
        cliSkipped: 1,
        gitCommit: 'abc1234',
      }).run();

      // Query back
      const records = db
        .select()
        .from(toolVerifications)
        .where(eq(toolVerifications.toolId, 'tool-a'))
        .all();

      expect(records).toHaveLength(1);
      expect(records[0]!.overallStatus).toBe('pass');
      expect(records[0]!.cliPassed).toBe(5);
      expect(records[0]!.gitCommit).toBe('abc1234');
    });

    test('can store multiple verification records', () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create tool
      db.insert(tools).values({
        id: 'tool-a',
        name: 'Tool A',
        path: '/path/a',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      // Insert multiple verifications
      for (let i = 0; i < 5; i++) {
        db.insert(toolVerifications).values({
          toolId: 'tool-a',
          verifiedAt: new Date(Date.now() + i * 1000).toISOString(),
          overallStatus: i === 2 ? 'fail' : 'pass',
          cliPassed: 5 - i,
          cliFailed: i,
        }).run();
      }

      const records = db
        .select()
        .from(toolVerifications)
        .where(eq(toolVerifications.toolId, 'tool-a'))
        .orderBy(desc(toolVerifications.verifiedAt))
        .all();

      expect(records).toHaveLength(5);
      // Most recent first
      expect(records[0]!.cliFailed).toBe(4);
      expect(records[4]!.cliFailed).toBe(0);
    });

    test('can query with limit', () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create tool
      db.insert(tools).values({
        id: 'tool-a',
        name: 'Tool A',
        path: '/path/a',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      // Insert 10 verifications
      for (let i = 0; i < 10; i++) {
        db.insert(toolVerifications).values({
          toolId: 'tool-a',
          verifiedAt: new Date(Date.now() + i * 1000).toISOString(),
          overallStatus: 'pass',
        }).run();
      }

      const limited = db
        .select()
        .from(toolVerifications)
        .where(eq(toolVerifications.toolId, 'tool-a'))
        .orderBy(desc(toolVerifications.verifiedAt))
        .limit(3)
        .all();

      expect(limited).toHaveLength(3);
    });

    test('stores MCP verification results', () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create tool
      db.insert(tools).values({
        id: 'tool-a',
        name: 'Tool A',
        path: '/path/a',
        type: 'cli+mcp',
        createdAt: now,
        updatedAt: now,
      }).run();

      // Insert verification with MCP results
      db.insert(toolVerifications).values({
        toolId: 'tool-a',
        verifiedAt: now,
        overallStatus: 'fail',
        cliStatus: 'pass',
        cliPassed: 3,
        cliFailed: 0,
        mcpStatus: 'fail',
        mcpFound: 5,
        mcpMissing: 2,
        mcpExtra: 1,
      }).run();

      // Note: using .all()[0] due to Drizzle ORM .get() bug with new tables
      const records = db
        .select()
        .from(toolVerifications)
        .where(eq(toolVerifications.toolId, 'tool-a'))
        .all();

      expect(records).toHaveLength(1);
      expect(records[0]!.mcpStatus).toBe('fail');
      expect(records[0]!.mcpFound).toBe(5);
      expect(records[0]!.mcpMissing).toBe(2);
      expect(records[0]!.mcpExtra).toBe(1);
    });

    test('updates lastVerified on tools table', () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create tool without lastVerified
      db.insert(tools).values({
        id: 'tool-a',
        name: 'Tool A',
        path: '/path/a',
        type: 'cli',
        createdAt: now,
        updatedAt: now,
      }).run();

      // Check initial state (using .all()[0] due to Drizzle ORM .get() bug)
      let toolRecords = db.select().from(tools).where(eq(tools.id, 'tool-a')).all();
      expect(toolRecords).toHaveLength(1);
      expect(toolRecords[0]!.lastVerified).toBeNull();

      // Update lastVerified
      const verifiedAt = new Date().toISOString();
      db.update(tools)
        .set({ lastVerified: verifiedAt, updatedAt: verifiedAt })
        .where(eq(tools.id, 'tool-a'))
        .run();

      // Check updated state
      toolRecords = db.select().from(tools).where(eq(tools.id, 'tool-a')).all();
      expect(toolRecords).toHaveLength(1);
      expect(toolRecords[0]!.lastVerified).toBe(verifiedAt);
    });
  });
});
