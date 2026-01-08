/**
 * Tests for pai-deps schema hasher (F-014)
 *
 * Tests schema hashing and drift detection functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  normalizeJson,
  hashJson,
  hashSchemaFile,
  compareHashes,
  detectFieldChanges,
} from '../src/lib/hasher';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-hasher-test-${Date.now()}`);

describe('Schema Hasher (F-014)', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('normalizeJson', () => {
    test('normalizes primitive values', () => {
      expect(normalizeJson(null)).toBe('null');
      expect(normalizeJson(true)).toBe('true');
      expect(normalizeJson(false)).toBe('false');
      expect(normalizeJson(42)).toBe('42');
      expect(normalizeJson('hello')).toBe('"hello"');
    });

    test('normalizes arrays', () => {
      expect(normalizeJson([])).toBe('[]');
      expect(normalizeJson([1, 2, 3])).toBe('[1,2,3]');
      expect(normalizeJson(['a', 'b'])).toBe('["a","b"]');
    });

    test('normalizes objects with sorted keys', () => {
      const obj = { z: 1, a: 2, m: 3 };
      expect(normalizeJson(obj)).toBe('{"a":2,"m":3,"z":1}');
    });

    test('normalizes nested objects', () => {
      const obj = { outer: { z: 1, a: 2 }, inner: [{ b: 1, a: 2 }] };
      expect(normalizeJson(obj)).toBe('{"inner":[{"a":2,"b":1}],"outer":{"a":2,"z":1}}');
    });

    test('produces same output regardless of key order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const obj3 = { b: 2, c: 3, a: 1 };

      expect(normalizeJson(obj1)).toBe(normalizeJson(obj2));
      expect(normalizeJson(obj2)).toBe(normalizeJson(obj3));
    });
  });

  describe('hashJson', () => {
    test('produces consistent hash for same input', () => {
      const data = { name: 'test', value: 42 };
      const result1 = hashJson(data);
      const result2 = hashJson(data);

      expect(result1.hash).toBe(result2.hash);
    });

    test('produces different hash for different input', () => {
      const data1 = { name: 'test1' };
      const data2 = { name: 'test2' };

      const result1 = hashJson(data1);
      const result2 = hashJson(data2);

      expect(result1.hash).not.toBe(result2.hash);
    });

    test('produces same hash regardless of key order', () => {
      const data1 = { a: 1, b: 2 };
      const data2 = { b: 2, a: 1 };

      const result1 = hashJson(data1);
      const result2 = hashJson(data2);

      expect(result1.hash).toBe(result2.hash);
    });

    test('returns normalized JSON string', () => {
      const data = { z: 1, a: 2 };
      const result = hashJson(data);

      expect(result.normalized).toBe('{"a":2,"z":1}');
    });
  });

  describe('hashSchemaFile', () => {
    test('hashes valid JSON file', async () => {
      const schemaPath = join(TEST_DIR, 'schema.json');
      writeFileSync(schemaPath, JSON.stringify({ type: 'object', properties: {} }));

      const result = await hashSchemaFile(schemaPath);

      expect(result).not.toBeNull();
      expect(result?.hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    test('returns null for non-existent file', async () => {
      const result = await hashSchemaFile(join(TEST_DIR, 'nonexistent.json'));

      expect(result).toBeNull();
    });

    test('returns null for invalid JSON', async () => {
      const schemaPath = join(TEST_DIR, 'invalid.json');
      writeFileSync(schemaPath, 'not valid json {');

      const result = await hashSchemaFile(schemaPath);

      expect(result).toBeNull();
    });

    test('produces same hash for files with different formatting', async () => {
      const schema1Path = join(TEST_DIR, 'schema1.json');
      const schema2Path = join(TEST_DIR, 'schema2.json');

      // Same data, different formatting
      writeFileSync(schema1Path, '{"type":"object","properties":{}}');
      writeFileSync(
        schema2Path,
        JSON.stringify({ properties: {}, type: 'object' }, null, 2)
      );

      const result1 = await hashSchemaFile(schema1Path);
      const result2 = await hashSchemaFile(schema2Path);

      expect(result1?.hash).toBe(result2?.hash);
    });
  });

  describe('compareHashes', () => {
    test('returns unchanged when hashes match', () => {
      const hash = 'abc123';
      const result = compareHashes(hash, hash);

      expect(result.status).toBe('unchanged');
      expect(result.storedHash).toBe(hash);
      expect(result.currentHash).toBe(hash);
    });

    test('returns drift when hashes differ', () => {
      const result = compareHashes('abc123', 'def456');

      expect(result.status).toBe('drift');
      expect(result.storedHash).toBe('abc123');
      expect(result.currentHash).toBe('def456');
    });

    test('returns new when no stored hash', () => {
      const result = compareHashes(null, 'abc123');

      expect(result.status).toBe('new');
      expect(result.currentHash).toBe('abc123');
    });

    test('returns missing when no current hash', () => {
      const result = compareHashes('abc123', null);

      expect(result.status).toBe('missing');
      expect(result.storedHash).toBe('abc123');
    });

    test('returns error when both hashes missing', () => {
      const result = compareHashes(null, null);

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    test('handles undefined as null', () => {
      const result = compareHashes(undefined, 'abc123');

      expect(result.status).toBe('new');
    });
  });

  describe('detectFieldChanges', () => {
    test('detects added fields', () => {
      const oldData = { a: 1, b: 2 };
      const newData = { a: 1, b: 2, c: 3 };

      const result = detectFieldChanges(oldData, newData);

      expect(result.added).toEqual(['c']);
      expect(result.removed).toEqual([]);
    });

    test('detects removed fields', () => {
      const oldData = { a: 1, b: 2, c: 3 };
      const newData = { a: 1, b: 2 };

      const result = detectFieldChanges(oldData, newData);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual(['c']);
    });

    test('detects both added and removed fields', () => {
      const oldData = { a: 1, b: 2 };
      const newData = { a: 1, c: 3 };

      const result = detectFieldChanges(oldData, newData);

      expect(result.added).toEqual(['c']);
      expect(result.removed).toEqual(['b']);
    });

    test('returns empty arrays when no changes', () => {
      const oldData = { a: 1, b: 2 };
      const newData = { a: 1, b: 2 };

      const result = detectFieldChanges(oldData, newData);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    test('handles non-objects', () => {
      const result = detectFieldChanges('string', 123);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    test('handles arrays', () => {
      const result = detectFieldChanges([1, 2, 3], [4, 5, 6]);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });
  });
});
