/**
 * Database tests for pai-deps
 *
 * Tests cover:
 * - Database creation on first access
 * - Directory auto-creation
 * - Insert and retrieve operations
 * - Foreign key constraint enforcement
 * - Cascade delete behavior
 * - Environment variable override for test database path
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import {
  getDb,
  closeDb,
  resetDb,
  getDbPath,
  tools,
  dependencies,
  contracts,
  verifications,
  circularDeps,
} from '../src/db';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('Database', () => {
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

  test('respects PAI_DEPS_DB environment variable', () => {
    expect(getDbPath()).toBe(TEST_DB_PATH);
  });

  test('creates database on first access', () => {
    expect(existsSync(TEST_DB_PATH)).toBe(false);

    const db = getDb();
    expect(db).toBeDefined();
    expect(existsSync(TEST_DB_PATH)).toBe(true);
  });

  test('creates directory automatically if it does not exist', () => {
    // Remove test directory
    rmSync(TEST_DIR, { recursive: true, force: true });
    expect(existsSync(TEST_DIR)).toBe(false);

    // Getting db should create directory and database
    const db = getDb();
    expect(db).toBeDefined();
    expect(existsSync(TEST_DIR)).toBe(true);
    expect(existsSync(TEST_DB_PATH)).toBe(true);
  });

  test('returns same instance on subsequent calls', () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  test('inserts and retrieves tool', () => {
    const db = getDb();
    const now = new Date().toISOString();

    db.insert(tools).values({
      id: 'test-tool',
      name: 'Test Tool',
      path: '/test/path',
      type: 'cli',
      createdAt: now,
      updatedAt: now,
    }).run();

    const result = db.select().from(tools).where(eq(tools.id, 'test-tool')).all();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Test Tool');
    expect(result[0]?.type).toBe('cli');
    expect(result[0]?.reliability).toBe(0.95); // Default value
    expect(result[0]?.stub).toBe(0); // Default value
  });

  test('enforces foreign key constraints on dependencies', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Attempt to insert dependency with non-existent consumer_id
    expect(() => {
      db.insert(dependencies).values({
        consumerId: 'nonexistent',
        providerId: 'also-nonexistent',
        type: 'cli',
        createdAt: now,
      }).run();
    }).toThrow();
  });

  test('enforces foreign key constraints on contracts', () => {
    const db = getDb();

    // Attempt to insert contract with non-existent tool_id
    expect(() => {
      db.insert(contracts).values({
        toolId: 'nonexistent',
        contractType: 'cli_output',
        name: 'test-contract',
      }).run();
    }).toThrow();
  });

  test('enforces foreign key constraints on verifications', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Attempt to insert verification with non-existent contract_id
    expect(() => {
      db.insert(verifications).values({
        contractId: 999,
        verifiedAt: now,
        status: 'pass',
      }).run();
    }).toThrow();
  });

  test('cascade deletes dependencies when tool is deleted', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Create two tools
    db.insert(tools).values([
      { id: 'tool-a', name: 'Tool A', path: '/a', type: 'cli', createdAt: now, updatedAt: now },
      { id: 'tool-b', name: 'Tool B', path: '/b', type: 'cli', createdAt: now, updatedAt: now },
    ]).run();

    // Create dependency from A to B
    db.insert(dependencies).values({
      consumerId: 'tool-a',
      providerId: 'tool-b',
      type: 'cli',
      createdAt: now,
    }).run();

    // Verify dependency exists
    let deps = db.select().from(dependencies).all();
    expect(deps).toHaveLength(1);

    // Delete tool-a (consumer)
    db.delete(tools).where(eq(tools.id, 'tool-a')).run();

    // Dependency should be cascade deleted
    deps = db.select().from(dependencies).all();
    expect(deps).toHaveLength(0);
  });

  test('cascade deletes contracts when tool is deleted', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Create a tool
    db.insert(tools).values({
      id: 'tool-with-contract',
      name: 'Tool',
      path: '/tool',
      type: 'cli',
      createdAt: now,
      updatedAt: now,
    }).run();

    // Create contract for the tool
    db.insert(contracts).values({
      toolId: 'tool-with-contract',
      contractType: 'cli_output',
      name: 'test --json',
    }).run();

    // Verify contract exists
    let cts = db.select().from(contracts).all();
    expect(cts).toHaveLength(1);

    // Delete the tool
    db.delete(tools).where(eq(tools.id, 'tool-with-contract')).run();

    // Contract should be cascade deleted
    cts = db.select().from(contracts).all();
    expect(cts).toHaveLength(0);
  });

  test('cascade deletes verifications when contract is deleted', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Create a tool
    db.insert(tools).values({
      id: 'tool-for-verification',
      name: 'Tool',
      path: '/tool',
      type: 'cli',
      createdAt: now,
      updatedAt: now,
    }).run();

    // Create contract
    const contractResult = db.insert(contracts).values({
      toolId: 'tool-for-verification',
      contractType: 'cli_output',
      name: 'test --json',
    }).returning().all();

    const contractId = contractResult[0]?.id;
    expect(contractId).toBeDefined();

    // Create verification
    db.insert(verifications).values({
      contractId: contractId!,
      verifiedAt: now,
      status: 'pass',
    }).run();

    // Verify verification exists
    let vers = db.select().from(verifications).all();
    expect(vers).toHaveLength(1);

    // Delete the tool (should cascade to contracts and then to verifications)
    db.delete(tools).where(eq(tools.id, 'tool-for-verification')).run();

    // Verification should be cascade deleted
    vers = db.select().from(verifications).all();
    expect(vers).toHaveLength(0);
  });

  test('inserts and retrieves circular dependency', () => {
    const db = getDb();
    const now = new Date().toISOString();
    const cycleArray = ['tool-a', 'tool-b', 'tool-c', 'tool-a'];

    db.insert(circularDeps).values({
      cycle: JSON.stringify(cycleArray),
      detectedAt: now,
    }).run();

    const result = db.select().from(circularDeps).all();
    expect(result).toHaveLength(1);
    expect(JSON.parse(result[0]?.cycle ?? '[]')).toEqual(cycleArray);
    expect(result[0]?.resolved).toBe(0);
  });

  test('handles multiple tools with different types', () => {
    const db = getDb();
    const now = new Date().toISOString();

    const testTools = [
      { id: 'cli-tool', name: 'CLI Tool', path: '/cli', type: 'cli' },
      { id: 'mcp-tool', name: 'MCP Tool', path: '/mcp', type: 'mcp' },
      { id: 'lib-tool', name: 'Library', path: '/lib', type: 'library' },
      { id: 'wf-tool', name: 'Workflow', path: '/wf', type: 'workflow' },
      { id: 'hook-tool', name: 'Hook', path: '/hook', type: 'hook' },
    ];

    for (const tool of testTools) {
      db.insert(tools).values({
        ...tool,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    const result = db.select().from(tools).all();
    expect(result).toHaveLength(5);

    // Query by type
    const cliTools = db.select().from(tools).where(eq(tools.type, 'cli')).all();
    expect(cliTools).toHaveLength(1);
    expect(cliTools[0]?.id).toBe('cli-tool');
  });

  test('supports optional fields with null values', () => {
    const db = getDb();
    const now = new Date().toISOString();

    db.insert(tools).values({
      id: 'minimal-tool',
      name: 'Minimal',
      path: '/minimal',
      type: 'cli',
      createdAt: now,
      updatedAt: now,
      // All optional fields left undefined
    }).run();

    const result = db.select().from(tools).where(eq(tools.id, 'minimal-tool')).all();
    expect(result).toHaveLength(1);
    expect(result[0]?.version).toBeNull();
    expect(result[0]?.manifestPath).toBeNull();
    expect(result[0]?.lastVerified).toBeNull();
  });

  test('updates tool fields correctly', () => {
    const db = getDb();
    const now = new Date().toISOString();

    db.insert(tools).values({
      id: 'update-tool',
      name: 'Original Name',
      path: '/original',
      type: 'cli',
      createdAt: now,
      updatedAt: now,
    }).run();

    const later = new Date(Date.now() + 1000).toISOString();
    db.update(tools)
      .set({ name: 'Updated Name', updatedAt: later })
      .where(eq(tools.id, 'update-tool'))
      .run();

    const result = db.select().from(tools).where(eq(tools.id, 'update-tool')).all();
    expect(result[0]?.name).toBe('Updated Name');
    expect(result[0]?.updatedAt).toBe(later);
    expect(result[0]?.createdAt).toBe(now); // Should not change
  });
});
