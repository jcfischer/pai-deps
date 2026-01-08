/**
 * Hook commands for pai-deps
 *
 * Provides git hook management:
 * - hook install: Install pre-commit hook
 * - hook uninstall: Remove pre-commit hook
 * - hook status: Show hook installation status
 */

import type { Command } from 'commander';
import { getGlobalOptions, error as logError, success as logSuccess, warn as logWarn } from '../lib/output.js';
import {
  HookManager,
  NotGitRepoError,
  HookExistsError,
  ForeignHookError,
  type HookStatus,
} from '../lib/hook/index.js';

/**
 * Options for hook install command
 */
interface HookInstallOptions {
  force?: boolean;
  quick?: boolean;
}

/**
 * JSON output for hook install
 */
interface HookInstallJsonOutput {
  success: boolean;
  error?: string;
  backupCreated?: boolean;
  hookPath?: string;
}

/**
 * JSON output for hook uninstall
 */
interface HookUninstallJsonOutput {
  success: boolean;
  error?: string;
  backupRestored?: boolean;
}

/**
 * JSON output for hook status
 */
interface HookStatusJsonOutput extends HookStatus {
  success: boolean;
  error?: string;
}

/**
 * Format hook status for human display
 */
function formatStatus(status: HookStatus): string {
  const lines: string[] = [];

  lines.push('Pre-commit Hook Status');
  lines.push('═'.repeat(30));
  lines.push('');

  if (status.foreignHookExists) {
    lines.push('Installed: No (foreign hook exists)');
    lines.push('');
    lines.push('A pre-commit hook exists but was not installed by pai-deps.');
    lines.push('Use "pai-deps hook install --force" to replace it.');
  } else if (status.installed) {
    lines.push('Installed: Yes');
    if (status.installedAt) {
      const date = new Date(status.installedAt);
      lines.push(`Installed at: ${date.toLocaleString()}`);
    }
    lines.push(`Quick mode: ${status.quickMode ? 'Yes' : 'No'}`);
    lines.push(`Backup exists: ${status.backupExists ? 'Yes' : 'No'}`);
  } else {
    lines.push('Installed: No');
    if (status.backupExists) {
      lines.push('');
      lines.push('A backup hook exists. It will be restored if you uninstall.');
    }
  }

  return lines.join('\n');
}

/**
 * Register the hook commands with the program
 */
export function hookCommand(program: Command): void {
  const hook = program
    .command('hook')
    .description('Git pre-commit hook management');

  // hook install
  hook.command('install')
    .description('Install pre-commit hook for contract verification')
    .option('--force', 'Overwrite existing hook (creates backup)')
    .option('--quick', 'Configure hook to use --quick flag')
    .action((options: HookInstallOptions) => {
      const opts = getGlobalOptions();

      try {
        const manager = new HookManager();
        const result = manager.install({
          force: options.force,
          quick: options.quick,
        });

        if (opts.json) {
          const output: HookInstallJsonOutput = {
            success: true,
            backupCreated: result.backupCreated,
            hookPath: result.hookPath,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          if (result.backupCreated) {
            logWarn('Existing hook backed up to pre-commit.backup');
          }
          logSuccess(`Pre-commit hook installed at ${result.hookPath}`);
          if (options.quick) {
            console.log('Quick mode enabled: Hook will use --quick flag for faster checks.');
          }
        }

        process.exit(0);
      } catch (err) {
        if (err instanceof NotGitRepoError) {
          if (opts.json) {
            const output: HookInstallJsonOutput = {
              success: false,
              error: err.message,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(err.message);
          }
          process.exit(2);
        }

        if (err instanceof HookExistsError) {
          if (opts.json) {
            const output: HookInstallJsonOutput = {
              success: false,
              error: err.message,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(err.message);
          }
          process.exit(1);
        }

        if (opts.json) {
          const output: HookInstallJsonOutput = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(err instanceof Error ? err.message : String(err));
        }
        process.exit(1);
      }
    });

  // hook uninstall
  hook.command('uninstall')
    .description('Remove pre-commit hook installed by pai-deps')
    .action(() => {
      const opts = getGlobalOptions();

      try {
        const manager = new HookManager();
        const result = manager.uninstall();

        if (opts.json) {
          const output: HookUninstallJsonOutput = {
            success: true,
            backupRestored: result.backupRestored,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          if (result.backupRestored) {
            logSuccess('Pre-commit hook removed. Previous hook restored from backup.');
          } else {
            logSuccess('Pre-commit hook removed.');
          }
        }

        process.exit(0);
      } catch (err) {
        if (err instanceof NotGitRepoError) {
          if (opts.json) {
            const output: HookUninstallJsonOutput = {
              success: false,
              error: err.message,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(err.message);
          }
          process.exit(2);
        }

        if (err instanceof ForeignHookError) {
          if (opts.json) {
            const output: HookUninstallJsonOutput = {
              success: false,
              error: err.message,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(err.message);
          }
          process.exit(1);
        }

        if (opts.json) {
          const output: HookUninstallJsonOutput = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(err instanceof Error ? err.message : String(err));
        }
        process.exit(1);
      }
    });

  // hook status
  hook.command('status')
    .description('Show pre-commit hook installation status')
    .action(() => {
      const opts = getGlobalOptions();

      try {
        const manager = new HookManager();
        const status = manager.status();

        if (opts.json) {
          const output: HookStatusJsonOutput = {
            success: true,
            ...status,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(formatStatus(status));
        }

        process.exit(0);
      } catch (err) {
        if (err instanceof NotGitRepoError) {
          if (opts.json) {
            const output: HookStatusJsonOutput = {
              success: false,
              error: err.message,
              installed: false,
              installedAt: null,
              quickMode: false,
              backupExists: false,
              foreignHookExists: false,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(err.message);
          }
          process.exit(2);
        }

        if (opts.json) {
          const output: HookStatusJsonOutput = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            installed: false,
            installedAt: null,
            quickMode: false,
            backupExists: false,
            foreignHookExists: false,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(err instanceof Error ? err.message : String(err));
        }
        process.exit(1);
      }
    });
}
