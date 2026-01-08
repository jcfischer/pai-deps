/**
 * Tests for validator module
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateAgainstSchema,
  loadSchemaFile,
  formatValidationErrors,
  type ValidationError,
} from '../src/lib/validator';

const TEST_DIR = join(tmpdir(), `pai-deps-validator-test-${Date.now()}`);

describe('validator', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('validateAgainstSchema', () => {
    test('returns valid for conforming data', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      const data = { name: 'Alice', age: 30 };
      const result = validateAgainstSchema(schema, data);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test('returns invalid for missing required field', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };

      const data = { age: 30 };
      const result = validateAgainstSchema(schema, data);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]!.keyword).toBe('required');
    });

    test('returns invalid for wrong type', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number' },
        },
      };

      const data = { count: 'not a number' };
      const result = validateAgainstSchema(schema, data);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]!.keyword).toBe('type');
      expect(result.errors![0]!.path).toBe('/count');
    });

    test('validates nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
            },
            required: ['email'],
          },
        },
      };

      const data = { user: { email: 'not-an-email' } };
      const result = validateAgainstSchema(schema, data);

      expect(result.valid).toBe(false);
      expect(result.errors![0]!.path).toBe('/user/email');
    });

    test('validates arrays', () => {
      const schema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'number' },
          },
        },
      };

      const data = { items: [1, 2, 'three'] };
      const result = validateAgainstSchema(schema, data);

      expect(result.valid).toBe(false);
      expect(result.errors![0]!.path).toBe('/items/2');
    });

    test('validates empty object against permissive schema', () => {
      const schema = { type: 'object' };
      const data = {};
      const result = validateAgainstSchema(schema, data);

      expect(result.valid).toBe(true);
    });

    test('validates null when allowed', () => {
      const schema = { type: ['string', 'null'] };

      expect(validateAgainstSchema(schema, null).valid).toBe(true);
      expect(validateAgainstSchema(schema, 'hello').valid).toBe(true);
      expect(validateAgainstSchema(schema, 123).valid).toBe(false);
    });
  });

  describe('loadSchemaFile', () => {
    test('loads valid JSON schema file', async () => {
      const schemaPath = join(TEST_DIR, 'schema.json');
      const schema = { type: 'object', properties: { id: { type: 'string' } } };
      writeFileSync(schemaPath, JSON.stringify(schema));

      const loaded = await loadSchemaFile(schemaPath);

      expect(loaded).toEqual(schema);
    });

    test('returns null for non-existent file', async () => {
      const loaded = await loadSchemaFile(join(TEST_DIR, 'nonexistent.json'));
      expect(loaded).toBeNull();
    });

    test('returns null for invalid JSON', async () => {
      const schemaPath = join(TEST_DIR, 'invalid.json');
      writeFileSync(schemaPath, '{ not valid json }');

      const loaded = await loadSchemaFile(schemaPath);
      expect(loaded).toBeNull();
    });
  });

  describe('formatValidationErrors', () => {
    test('formats single error', () => {
      const errors: ValidationError[] = [
        { path: '/name', message: 'must be string', keyword: 'type', params: {} },
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain('/name');
      expect(formatted).toContain('must be string');
    });

    test('formats multiple errors', () => {
      const errors: ValidationError[] = [
        { path: '/name', message: 'must be string', keyword: 'type', params: {} },
        { path: '/age', message: 'must be number', keyword: 'type', params: {} },
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain('/name');
      expect(formatted).toContain('/age');
    });

    test('handles empty errors array', () => {
      const formatted = formatValidationErrors([]);
      expect(formatted).toBe('No errors');
    });

    test('handles root path errors', () => {
      const errors: ValidationError[] = [
        { path: '', message: 'must be object', keyword: 'type', params: {} },
      ];

      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain('/');
    });
  });
});
