/**
 * Tests for pai-deps verify command (F-013)
 *
 * Tests CLI contract verification functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb, resetDb } from '../src/db';
import { verifyCliCommand, verifyTool, getToolCliCommands } from '../src/lib/verifier';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-verify-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'test.db');

describe('CLI contract verification (F-013)', () => {
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

  describe('verifyCliCommand', () => {
    test('returns pass for existing command', async () => {
      // Use 'ls' which exists on all Unix systems
      const result = await verifyCliCommand('ls', { quick: true, timeout: 5000 });

      expect(result.status).toBe('pass');
      expect(result.checks.exists).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    test('returns fail for non-existent command', async () => {
      const result = await verifyCliCommand('this-command-does-not-exist-xyz123', {
        quick: true,
        timeout: 5000,
      });

      expect(result.status).toBe('fail');
      expect(result.checks.exists).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('handles command with arguments', async () => {
      // Test that argument placeholders are stripped
      const result = await verifyCliCommand('ls <path>', { quick: true, timeout: 5000 });

      expect(result.status).toBe('pass');
      expect(result.checks.exists).toBe(true);
    });

    test('handles command with optional arguments', async () => {
      const result = await verifyCliCommand('ls [options...]', { quick: true, timeout: 5000 });

      expect(result.status).toBe('pass');
      expect(result.checks.exists).toBe(true);
    });

    test('returns duration in milliseconds', async () => {
      const result = await verifyCliCommand('ls', { quick: true, timeout: 5000 });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThan(5000);
    });
  });

  describe('getToolCliCommands', () => {
    test('returns commands from valid manifest', async () => {
      // Create a test manifest
      const toolDir = join(TEST_DIR, 'test-tool');
      mkdirSync(toolDir, { recursive: true });

      writeFileSync(
        join(toolDir, 'pai-manifest.yaml'),
        `name: test-tool
version: 1.0.0
type: cli

provides:
  cli:
    - command: test-tool run
    - command: test-tool status

reliability: 0.95
`
      );

      const commands = await getToolCliCommands(toolDir);

      expect(commands).toEqual(['test-tool run', 'test-tool status']);
    });

    test('returns empty array for manifest without CLI', async () => {
      const toolDir = join(TEST_DIR, 'lib-tool');
      mkdirSync(toolDir, { recursive: true });

      writeFileSync(
        join(toolDir, 'pai-manifest.yaml'),
        `name: lib-tool
version: 1.0.0
type: library

provides:
  library:
    - export: default

reliability: 0.95
`
      );

      const commands = await getToolCliCommands(toolDir);

      expect(commands).toEqual([]);
    });

    test('returns null for missing manifest', async () => {
      const toolDir = join(TEST_DIR, 'no-manifest');
      mkdirSync(toolDir, { recursive: true });

      const commands = await getToolCliCommands(toolDir);

      expect(commands).toBeNull();
    });
  });

  describe('verifyTool', () => {
    test('skips library tools', async () => {
      const result = await verifyTool('test-lib', '/some/path', 'library');

      expect(result.summary.skipped).toBe(1);
      expect(result.summary.passed).toBe(0);
      expect(result.summary.failed).toBe(0);
    });

    test('reports missing manifest', async () => {
      const nonExistentPath = join(TEST_DIR, 'non-existent');
      const result = await verifyTool('missing', nonExistentPath, 'cli');

      expect(result.summary.skipped).toBe(1);
      expect(result.results[0]?.error).toContain('manifest');
    });

    test('verifies tool with CLI commands', async () => {
      // Create a test tool with ls command (which will exist)
      const toolDir = join(TEST_DIR, 'ls-tool');
      mkdirSync(toolDir, { recursive: true });

      writeFileSync(
        join(toolDir, 'pai-manifest.yaml'),
        `name: ls-tool
version: 1.0.0
type: cli

provides:
  cli:
    - command: ls

reliability: 0.95
`
      );

      const result = await verifyTool('ls-tool', toolDir, 'cli', { quick: true });

      expect(result.summary.passed).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(result.results[0]?.status).toBe('pass');
    });

    test('reports failed commands', async () => {
      const toolDir = join(TEST_DIR, 'bad-tool');
      mkdirSync(toolDir, { recursive: true });

      writeFileSync(
        join(toolDir, 'pai-manifest.yaml'),
        `name: bad-tool
version: 1.0.0
type: cli

provides:
  cli:
    - command: nonexistent-command-xyz

reliability: 0.95
`
      );

      const result = await verifyTool('bad-tool', toolDir, 'cli', { quick: true });

      expect(result.summary.failed).toBe(1);
      expect(result.summary.passed).toBe(0);
      expect(result.results[0]?.status).toBe('fail');
    });

    test('handles tool with no CLI provides', async () => {
      const toolDir = join(TEST_DIR, 'no-cli');
      mkdirSync(toolDir, { recursive: true });

      writeFileSync(
        join(toolDir, 'pai-manifest.yaml'),
        `name: no-cli
version: 1.0.0
type: cli

provides:
  library:
    - export: main

reliability: 0.95
`
      );

      const result = await verifyTool('no-cli', toolDir, 'cli', { quick: true });

      expect(result.summary.skipped).toBe(1);
    });
  });
});
