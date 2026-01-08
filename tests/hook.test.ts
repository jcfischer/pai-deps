/**
 * Tests for pai-deps hook command (F-023)
 *
 * Tests git pre-commit hook management functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, statSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import {
  HookManager,
  NotGitRepoError,
  HookExistsError,
  ForeignHookError,
  generateHookScript,
  isPaiDepsHook,
  parseHookMetadata,
  HOOK_MARKER,
} from '../src/lib/hook/index.js';

// Use a unique temp directory for each test run
const TEST_DIR = join(tmpdir(), `pai-deps-hook-test-${Date.now()}`);

/**
 * Initialize a git repository in the given directory
 */
function initGitRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
}

describe('Hook management (F-023)', () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('generateHookScript', () => {
    test('generates POSIX-compliant script', () => {
      const script = generateHookScript({ quick: false });

      expect(script).toStartWith('#!/bin/sh\n');
      expect(script).toContain(HOOK_MARKER);
    });

    test('includes installation timestamp', () => {
      const before = new Date().toISOString();
      const script = generateHookScript({ quick: false });
      const after = new Date().toISOString();

      // Extract timestamp from script
      const match = script.match(/# Installed: (.+)\n/);
      expect(match).toBeTruthy();

      const timestamp = match![1]!;
      expect(timestamp >= before).toBe(true);
      expect(timestamp <= after).toBe(true);
    });

    test('includes quick mode flag when enabled', () => {
      const script = generateHookScript({ quick: true });

      expect(script).toContain('# Quick mode: true');
      expect(script).toContain('pai-deps ci check --staged --quick');
    });

    test('omits quick flag when disabled', () => {
      const script = generateHookScript({ quick: false });

      expect(script).toContain('# Quick mode: false');
      expect(script).not.toContain('--quick');
      expect(script).toContain('pai-deps ci check --staged\n');
    });

    test('includes graceful skip if pai-deps not found', () => {
      const script = generateHookScript({ quick: false });

      expect(script).toContain('if ! command -v pai-deps');
      expect(script).toContain('echo "pai-deps not found');
      expect(script).toContain('exit 0');
    });

    test('exits with command exit code', () => {
      const script = generateHookScript({ quick: false });

      expect(script).toContain('exit $?');
    });
  });

  describe('isPaiDepsHook', () => {
    test('returns true for pai-deps hook', () => {
      const content = generateHookScript({ quick: false });
      expect(isPaiDepsHook(content)).toBe(true);
    });

    test('returns false for foreign hook', () => {
      const content = '#!/bin/sh\necho "Hello World"';
      expect(isPaiDepsHook(content)).toBe(false);
    });

    test('returns false for empty content', () => {
      expect(isPaiDepsHook('')).toBe(false);
    });
  });

  describe('parseHookMetadata', () => {
    test('parses metadata from valid hook', () => {
      const script = generateHookScript({ quick: true });
      const metadata = parseHookMetadata(script);

      expect(metadata).toBeTruthy();
      expect(metadata!.marker).toBe('pai-deps pre-commit hook');
      expect(metadata!.quickMode).toBe(true);
      expect(metadata!.installedAt).toBeTruthy();
    });

    test('returns null for foreign hook', () => {
      const content = '#!/bin/sh\necho "Hello World"';
      const metadata = parseHookMetadata(content);

      expect(metadata).toBeNull();
    });

    test('parses quick mode false', () => {
      const script = generateHookScript({ quick: false });
      const metadata = parseHookMetadata(script);

      expect(metadata!.quickMode).toBe(false);
    });

    test('handles ISO timestamp format', () => {
      const script = generateHookScript({ quick: false });
      const metadata = parseHookMetadata(script);

      // Should be valid ISO date
      const date = new Date(metadata!.installedAt);
      expect(date.toISOString()).toBe(metadata!.installedAt);
    });
  });

  describe('HookManager', () => {
    test('throws NotGitRepoError when not in git repo', () => {
      expect(() => new HookManager(TEST_DIR)).toThrow(NotGitRepoError);
    });

    describe('in git repository', () => {
      let repoDir: string;

      beforeEach(() => {
        repoDir = join(TEST_DIR, 'repo');
        initGitRepo(repoDir);
      });

      describe('install', () => {
        test('creates hook script', () => {
          const manager = new HookManager(repoDir);
          const result = manager.install();

          expect(result.success).toBe(true);
          expect(result.backupCreated).toBe(false);
          expect(existsSync(result.hookPath)).toBe(true);
        });

        test('creates hooks directory if missing', () => {
          const hooksDir = join(repoDir, '.git', 'hooks');
          if (existsSync(hooksDir)) {
            rmSync(hooksDir, { recursive: true, force: true });
          }

          const manager = new HookManager(repoDir);
          const result = manager.install();

          expect(result.success).toBe(true);
          expect(existsSync(hooksDir)).toBe(true);
        });

        test('sets executable permissions', () => {
          const manager = new HookManager(repoDir);
          const result = manager.install();

          const stats = statSync(result.hookPath);
          const mode = stats.mode & 0o777;
          // Check that owner has execute permission
          expect(mode & 0o100).toBe(0o100);
        });

        test('includes quick flag when specified', () => {
          const manager = new HookManager(repoDir);
          manager.install({ quick: true });

          const hookPath = manager.getHookPath();
          const content = readFileSync(hookPath, 'utf-8');
          expect(content).toContain('--quick');
        });

        test('throws HookExistsError if hook exists without force', () => {
          const manager = new HookManager(repoDir);
          manager.install();

          expect(() => manager.install()).toThrow(HookExistsError);
        });

        test('creates backup when using force', () => {
          const manager = new HookManager(repoDir);
          manager.install();

          const result = manager.install({ force: true });

          expect(result.success).toBe(true);
          expect(result.backupCreated).toBe(true);
          expect(existsSync(manager.getBackupPath())).toBe(true);
        });

        test('replaces foreign hook when using force', () => {
          const hooksDir = join(repoDir, '.git', 'hooks');
          mkdirSync(hooksDir, { recursive: true });
          const hookPath = join(hooksDir, 'pre-commit');
          writeFileSync(hookPath, '#!/bin/sh\necho "foreign hook"', { mode: 0o755 });

          const manager = new HookManager(repoDir);
          const result = manager.install({ force: true });

          expect(result.success).toBe(true);
          expect(result.backupCreated).toBe(true);

          const content = readFileSync(hookPath, 'utf-8');
          expect(isPaiDepsHook(content)).toBe(true);
        });
      });

      describe('uninstall', () => {
        test('removes pai-deps hook', () => {
          const manager = new HookManager(repoDir);
          manager.install();

          const result = manager.uninstall();

          expect(result.success).toBe(true);
          expect(result.backupRestored).toBe(false);
          expect(existsSync(manager.getHookPath())).toBe(false);
        });

        test('succeeds if no hook exists', () => {
          const manager = new HookManager(repoDir);
          const result = manager.uninstall();

          expect(result.success).toBe(true);
          expect(result.backupRestored).toBe(false);
        });

        test('restores backup if exists', () => {
          const hooksDir = join(repoDir, '.git', 'hooks');
          mkdirSync(hooksDir, { recursive: true });

          // Create a backup file
          const backupPath = join(hooksDir, 'pre-commit.backup');
          writeFileSync(backupPath, '#!/bin/sh\necho "original hook"', { mode: 0o755 });

          const manager = new HookManager(repoDir);
          manager.install();

          const result = manager.uninstall();

          expect(result.success).toBe(true);
          expect(result.backupRestored).toBe(true);
          expect(existsSync(manager.getHookPath())).toBe(true);

          const content = readFileSync(manager.getHookPath(), 'utf-8');
          expect(content).toContain('original hook');
        });

        test('throws ForeignHookError for non-pai-deps hook', () => {
          const hooksDir = join(repoDir, '.git', 'hooks');
          mkdirSync(hooksDir, { recursive: true });
          writeFileSync(join(hooksDir, 'pre-commit'), '#!/bin/sh\necho "foreign"', { mode: 0o755 });

          const manager = new HookManager(repoDir);

          expect(() => manager.uninstall()).toThrow(ForeignHookError);
        });

        test('restores backup when no hook but backup exists', () => {
          const hooksDir = join(repoDir, '.git', 'hooks');
          mkdirSync(hooksDir, { recursive: true });

          // Create only backup file
          const backupPath = join(hooksDir, 'pre-commit.backup');
          writeFileSync(backupPath, '#!/bin/sh\necho "backup"', { mode: 0o755 });

          const manager = new HookManager(repoDir);
          const result = manager.uninstall();

          expect(result.success).toBe(true);
          expect(result.backupRestored).toBe(true);
          expect(existsSync(manager.getHookPath())).toBe(true);
        });
      });

      describe('status', () => {
        test('returns not installed when no hook', () => {
          const manager = new HookManager(repoDir);
          const status = manager.status();

          expect(status.installed).toBe(false);
          expect(status.installedAt).toBeNull();
          expect(status.quickMode).toBe(false);
          expect(status.backupExists).toBe(false);
          expect(status.foreignHookExists).toBe(false);
        });

        test('returns installed when pai-deps hook exists', () => {
          const manager = new HookManager(repoDir);
          manager.install({ quick: true });

          const status = manager.status();

          expect(status.installed).toBe(true);
          expect(status.installedAt).toBeTruthy();
          expect(status.quickMode).toBe(true);
          expect(status.foreignHookExists).toBe(false);
        });

        test('detects foreign hook', () => {
          const hooksDir = join(repoDir, '.git', 'hooks');
          mkdirSync(hooksDir, { recursive: true });
          writeFileSync(join(hooksDir, 'pre-commit'), '#!/bin/sh\necho "foreign"', { mode: 0o755 });

          const manager = new HookManager(repoDir);
          const status = manager.status();

          expect(status.installed).toBe(false);
          expect(status.foreignHookExists).toBe(true);
        });

        test('detects backup file', () => {
          const hooksDir = join(repoDir, '.git', 'hooks');
          mkdirSync(hooksDir, { recursive: true });
          writeFileSync(join(hooksDir, 'pre-commit.backup'), '#!/bin/sh\necho "backup"', { mode: 0o755 });

          const manager = new HookManager(repoDir);
          const status = manager.status();

          expect(status.backupExists).toBe(true);
        });

        test('returns quick mode setting', () => {
          const manager = new HookManager(repoDir);
          manager.install({ quick: false });

          const status = manager.status();
          expect(status.quickMode).toBe(false);
        });
      });

      describe('isPaiDepsHook', () => {
        test('returns true when pai-deps hook installed', () => {
          const manager = new HookManager(repoDir);
          manager.install();

          expect(manager.isPaiDepsHook()).toBe(true);
        });

        test('returns false when no hook', () => {
          const manager = new HookManager(repoDir);

          expect(manager.isPaiDepsHook()).toBe(false);
        });

        test('returns false for foreign hook', () => {
          const hooksDir = join(repoDir, '.git', 'hooks');
          mkdirSync(hooksDir, { recursive: true });
          writeFileSync(join(hooksDir, 'pre-commit'), '#!/bin/sh\necho "foreign"', { mode: 0o755 });

          const manager = new HookManager(repoDir);

          expect(manager.isPaiDepsHook()).toBe(false);
        });
      });
    });
  });

  describe('Zod schemas', () => {
    test('HookStatusSchema validates correct data', async () => {
      const { HookStatusSchema } = await import('../src/lib/hook/types.js');

      const result = HookStatusSchema.safeParse({
        installed: true,
        installedAt: '2026-01-08T10:30:00Z',
        quickMode: false,
        backupExists: false,
        foreignHookExists: false,
      });

      expect(result.success).toBe(true);
    });

    test('HookStatusSchema accepts null installedAt', async () => {
      const { HookStatusSchema } = await import('../src/lib/hook/types.js');

      const result = HookStatusSchema.safeParse({
        installed: false,
        installedAt: null,
        quickMode: false,
        backupExists: false,
        foreignHookExists: false,
      });

      expect(result.success).toBe(true);
    });

    test('InstallOptionsSchema provides defaults', async () => {
      const { InstallOptionsSchema } = await import('../src/lib/hook/types.js');

      const result = InstallOptionsSchema.parse({});

      expect(result.force).toBe(false);
      expect(result.quick).toBe(false);
    });
  });
});
