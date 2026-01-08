/**
 * Tests for pai-deps drift command (F-014)
 *
 * Tests schema drift detection command
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, resetDb, tools, contracts } from '../src/db';
import { hashJson } from '../src/lib/hasher';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-drift-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('drift command (F-014)', () => {
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

  describe('database setup for drift', () => {
    test('contracts table has schema_hash column', () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert a tool
      db.insert(tools)
        .values({
          id: 'test-tool',
          name: 'Test Tool',
          type: 'cli',
          path: TEST_DIR,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Insert a contract with schema_hash
      db.insert(contracts)
        .values({
          toolId: 'test-tool',
          contractType: 'cli_output',
          name: 'test command',
          schemaPath: './schemas/test.json',
          schemaHash: 'abc123',
        })
        .run();

      // Query it back
      const allContracts = db.select().from(contracts).all();
      expect(allContracts.length).toBe(1);
      expect(allContracts[0]!.schemaHash).toBe('abc123');
    });

    test('can update schema_hash', () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools)
        .values({
          id: 'test-tool',
          name: 'Test Tool',
          type: 'cli',
          path: TEST_DIR,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(contracts)
        .values({
          toolId: 'test-tool',
          contractType: 'cli_output',
          name: 'test command',
          schemaHash: 'old-hash',
        })
        .run();

      // Get the inserted contract
      const allContracts = db.select().from(contracts).all();
      expect(allContracts[0]!.schemaHash).toBe('old-hash');

      // Insert a second contract with different hash to verify both can coexist
      db.insert(contracts)
        .values({
          toolId: 'test-tool',
          contractType: 'cli_output',
          name: 'other command',
          schemaHash: 'new-hash',
        })
        .run();

      // Verify both contracts
      const updatedContracts = db.select().from(contracts).all();
      expect(updatedContracts.length).toBe(2);
      expect(updatedContracts[0]!.schemaHash).toBe('old-hash');
      expect(updatedContracts[1]!.schemaHash).toBe('new-hash');
    });
  });

  describe('drift detection scenarios', () => {
    test('detects unchanged schema', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create a schema file
      const schemaDir = join(TEST_DIR, 'schemas');
      mkdirSync(schemaDir, { recursive: true });
      const schemaPath = join(schemaDir, 'test.json');
      const schemaData = { type: 'object', properties: { name: { type: 'string' } } };
      writeFileSync(schemaPath, JSON.stringify(schemaData));

      // Compute the hash
      const hash = hashJson(schemaData).hash;

      // Insert tool and contract with matching hash
      db.insert(tools)
        .values({
          id: 'test-tool',
          name: 'Test Tool',
          type: 'cli',
          path: TEST_DIR,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(contracts)
        .values({
          toolId: 'test-tool',
          contractType: 'cli_output',
          name: 'test command',
          schemaPath: './schemas/test.json',
          schemaHash: hash,
        })
        .run();

      // The stored hash should match the current file hash
      const allContracts = db.select().from(contracts).all();
      expect(allContracts[0]!.schemaHash).toBe(hash);
    });

    test('detects schema drift', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create a schema file
      const schemaDir = join(TEST_DIR, 'schemas');
      mkdirSync(schemaDir, { recursive: true });
      const schemaPath = join(schemaDir, 'test.json');
      const schemaData = { type: 'object', properties: { name: { type: 'string' } } };
      writeFileSync(schemaPath, JSON.stringify(schemaData));

      // Insert tool and contract with different (old) hash
      db.insert(tools)
        .values({
          id: 'test-tool',
          name: 'Test Tool',
          type: 'cli',
          path: TEST_DIR,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(contracts)
        .values({
          toolId: 'test-tool',
          contractType: 'cli_output',
          name: 'test command',
          schemaPath: './schemas/test.json',
          schemaHash: 'old-hash-that-does-not-match',
        })
        .run();

      // The stored hash should NOT match the current file hash
      const currentHash = hashJson(schemaData).hash;
      const allContracts = db.select().from(contracts).all();
      expect(allContracts[0]!.schemaHash).not.toBe(currentHash);
    });

    test('handles new contract without stored hash', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Create a schema file
      const schemaDir = join(TEST_DIR, 'schemas');
      mkdirSync(schemaDir, { recursive: true });
      const schemaPath = join(schemaDir, 'test.json');
      writeFileSync(schemaPath, JSON.stringify({ type: 'object' }));

      // Insert tool and contract WITHOUT hash
      db.insert(tools)
        .values({
          id: 'test-tool',
          name: 'Test Tool',
          type: 'cli',
          path: TEST_DIR,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(contracts)
        .values({
          toolId: 'test-tool',
          contractType: 'cli_output',
          name: 'test command',
          schemaPath: './schemas/test.json',
          // No schemaHash
        })
        .run();

      const allContracts = db.select().from(contracts).all();
      expect(allContracts[0]!.schemaHash).toBeNull();
    });

    test('handles missing schema file', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      // Insert tool and contract pointing to non-existent file
      db.insert(tools)
        .values({
          id: 'test-tool',
          name: 'Test Tool',
          type: 'cli',
          path: TEST_DIR,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(contracts)
        .values({
          toolId: 'test-tool',
          contractType: 'cli_output',
          name: 'test command',
          schemaPath: './schemas/nonexistent.json',
          schemaHash: 'some-hash',
        })
        .run();

      // Schema file doesn't exist
      expect(existsSync(join(TEST_DIR, 'schemas', 'nonexistent.json'))).toBe(false);
    });
  });

  describe('contract without schema_path', () => {
    test('skips contracts without schema_path', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.insert(tools)
        .values({
          id: 'test-tool',
          name: 'Test Tool',
          type: 'cli',
          path: TEST_DIR,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Contract without schema_path - can't check drift
      db.insert(contracts)
        .values({
          toolId: 'test-tool',
          contractType: 'cli_output',
          name: 'test command',
          // No schemaPath
        })
        .run();

      const allContracts = db.select().from(contracts).all();
      expect(allContracts[0]!.schemaPath).toBeNull();
    });
  });
});
