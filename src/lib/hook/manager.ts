/**
 * Hook management - install, uninstall, and status operations
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, mkdirSync, statSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { isGitRepo, getRepoRoot } from '../ci/git.js';
import { generateHookScript } from './template.js';
import { isPaiDepsHook, parseHookMetadata } from './parser.js';
import type { HookStatus, InstallResult, UninstallResult, InstallOptions } from './types.js';

/**
 * Error thrown when not in a git repository
 */
export class NotGitRepoError extends Error {
  constructor() {
    super('Not in a git repository');
    this.name = 'NotGitRepoError';
  }
}

/**
 * Error thrown when hook exists but force not specified
 */
export class HookExistsError extends Error {
  constructor(public readonly isForeignHook: boolean) {
    super(isForeignHook
      ? 'A pre-commit hook already exists (not installed by pai-deps). Use --force to overwrite.'
      : 'A pai-deps pre-commit hook is already installed. Use --force to reinstall.');
    this.name = 'HookExistsError';
  }
}

/**
 * Error thrown when trying to uninstall a non-pai-deps hook
 */
export class ForeignHookError extends Error {
  constructor() {
    super('Pre-commit hook exists but was not installed by pai-deps. Remove it manually if intended.');
    this.name = 'ForeignHookError';
  }
}

/**
 * Manages git pre-commit hook installation
 */
export class HookManager {
  private readonly gitDir: string;
  private readonly hookPath: string;
  private readonly backupPath: string;

  constructor(cwd?: string) {
    if (!isGitRepo(cwd)) {
      throw new NotGitRepoError();
    }

    const repoRoot = getRepoRoot(cwd);
    this.gitDir = join(repoRoot, '.git');

    // Handle git worktrees where .git is a file pointing to the real git dir
    const gitStat = statSync(this.gitDir);
    if (!gitStat.isDirectory()) {
      const gitContent = readFileSync(this.gitDir, 'utf-8').trim();
      const gitdirMatch = gitContent.match(/^gitdir: (.+)$/);
      if (gitdirMatch) {
        this.gitDir = gitdirMatch[1]!;
      }
    }

    this.hookPath = join(this.gitDir, 'hooks', 'pre-commit');
    this.backupPath = join(this.gitDir, 'hooks', 'pre-commit.backup');
  }

  /**
   * Install pre-commit hook
   *
   * @param options - Installation options
   * @throws HookExistsError if hook exists and force not set
   */
  install(options: InstallOptions = {}): InstallResult {
    const { force = false, quick = false } = options;
    let backupCreated = false;

    // Ensure hooks directory exists
    const hooksDir = dirname(this.hookPath);
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }

    // Check for existing hook
    if (existsSync(this.hookPath)) {
      const content = readFileSync(this.hookPath, 'utf-8');
      const isForeign = !isPaiDepsHook(content);

      if (!force) {
        throw new HookExistsError(isForeign);
      }

      // Create backup
      renameSync(this.hookPath, this.backupPath);
      backupCreated = true;
    }

    // Generate and write hook script
    const script = generateHookScript({ quick });
    writeFileSync(this.hookPath, script, { mode: 0o755 });

    // Ensure executable (for systems that ignore mode in writeFileSync)
    chmodSync(this.hookPath, 0o755);

    return {
      success: true,
      backupCreated,
      hookPath: this.hookPath,
    };
  }

  /**
   * Uninstall pre-commit hook
   *
   * @throws ForeignHookError if hook exists but wasn't installed by pai-deps
   */
  uninstall(): UninstallResult {
    // No hook exists - success
    if (!existsSync(this.hookPath)) {
      // Check if backup exists and restore it
      if (existsSync(this.backupPath)) {
        renameSync(this.backupPath, this.hookPath);
        return { success: true, backupRestored: true };
      }
      return { success: true, backupRestored: false };
    }

    // Check if it's our hook
    const content = readFileSync(this.hookPath, 'utf-8');
    if (!isPaiDepsHook(content)) {
      throw new ForeignHookError();
    }

    // Remove our hook
    unlinkSync(this.hookPath);

    // Restore backup if it exists
    if (existsSync(this.backupPath)) {
      renameSync(this.backupPath, this.hookPath);
      return { success: true, backupRestored: true };
    }

    return { success: true, backupRestored: false };
  }

  /**
   * Get current hook status
   */
  status(): HookStatus {
    const backupExists = existsSync(this.backupPath);

    // No hook file
    if (!existsSync(this.hookPath)) {
      return {
        installed: false,
        installedAt: null,
        quickMode: false,
        backupExists,
        foreignHookExists: false,
      };
    }

    const content = readFileSync(this.hookPath, 'utf-8');

    // Foreign hook
    if (!isPaiDepsHook(content)) {
      return {
        installed: false,
        installedAt: null,
        quickMode: false,
        backupExists,
        foreignHookExists: true,
      };
    }

    // Our hook - parse metadata
    const metadata = parseHookMetadata(content);

    return {
      installed: true,
      installedAt: metadata?.installedAt ?? null,
      quickMode: metadata?.quickMode ?? false,
      backupExists,
      foreignHookExists: false,
    };
  }

  /**
   * Check if hook is a pai-deps hook
   */
  isPaiDepsHook(): boolean {
    if (!existsSync(this.hookPath)) {
      return false;
    }
    const content = readFileSync(this.hookPath, 'utf-8');
    return isPaiDepsHook(content);
  }

  /**
   * Get the hook file path
   */
  getHookPath(): string {
    return this.hookPath;
  }

  /**
   * Get the backup file path
   */
  getBackupPath(): string {
    return this.backupPath;
  }
}
