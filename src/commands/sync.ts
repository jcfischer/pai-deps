/**
 * Sync Command
 *
 * Discover and register all pai-manifest.yaml files in one command.
 */

import type { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { discoverManifests, getDefaultRoots } from '../lib/discovery';
import { registerTool } from '../lib/registry';
import { ManifestParseError } from '../lib/manifest';
import { getGlobalOptions } from '../lib/output';

/**
 * Sync command CLI options
 */
interface SyncCLIOptions {
  /** Additional root directories to include */
  include?: string[];
  /** Patterns to exclude */
  exclude?: string[];
  /** Maximum depth to search */
  maxDepth?: string;
  /** Disable gitignore support */
  noGitignore?: boolean;
  /** Force re-register even if unchanged */
  force?: boolean;
  /** Show what would happen without making changes */
  dryRun?: boolean;
}

/**
 * Result for a single manifest sync
 */
interface ManifestSyncResult {
  path: string;
  name: string | null;
  status: 'new' | 'updated' | 'unchanged' | 'error';
  error?: string;
}

/**
 * Overall sync result
 */
export interface SyncResult {
  total: number;
  new: number;
  updated: number;
  unchanged: number;
  errors: number;
  results: ManifestSyncResult[];
  dryRun: boolean;
}

/**
 * Execute the sync logic
 */
export async function executeSync(
  roots?: string[],
  options: {
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    maxDepth?: number | undefined;
    noGitignore?: boolean | undefined;
    force?: boolean | undefined;
    dryRun?: boolean | undefined;
    json?: boolean | undefined;
  } = {}
): Promise<SyncResult> {
  // Determine roots to search
  let searchRoots: string[];
  if (roots && roots.length > 0) {
    searchRoots = roots.map(r => resolve(r.replace(/^~/, process.env.HOME ?? '')));
  } else {
    searchRoots = getDefaultRoots();
  }

  // Add any include directories
  if (options.include) {
    for (const inc of options.include) {
      const resolved = resolve(inc.replace(/^~/, process.env.HOME ?? ''));
      if (!searchRoots.includes(resolved)) {
        searchRoots.push(resolved);
      }
    }
  }

  // Filter to valid roots
  const validRoots = searchRoots.filter(r => existsSync(r));
  if (validRoots.length === 0) {
    const result: SyncResult = {
      total: 0,
      new: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
      results: [],
      dryRun: options.dryRun ?? false,
    };
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('Error: No valid root directories found.');
    }
    return result;
  }

  // Discover manifests
  const manifests = await discoverManifests({
    roots: validRoots,
    exclude: options.exclude ?? [],
    maxDepth: options.maxDepth ?? 10,
    respectGitignore: !options.noGitignore,
  });

  const results: ManifestSyncResult[] = [];
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  // Process each manifest
  for (const manifest of manifests) {
    if (options.dryRun) {
      // Dry run - just report what would happen
      results.push({
        path: manifest.path,
        name: manifest.name,
        status: 'new', // Assume all would be processed in dry run
      });
      newCount++;
    } else {
      // Actually register
      try {
        const regResult = registerTool(manifest.dir);

        if (regResult.action === 'registered') {
          results.push({
            path: manifest.path,
            name: regResult.tool.name,
            status: 'new',
          });
          newCount++;
        } else {
          results.push({
            path: manifest.path,
            name: regResult.tool.name,
            status: 'updated',
          });
          updatedCount++;
        }
      } catch (err) {
        const errorMessage = err instanceof ManifestParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);

        results.push({
          path: manifest.path,
          name: manifest.name,
          status: 'error',
          error: errorMessage,
        });
        errorCount++;
      }
    }
  }

  const syncResult: SyncResult = {
    total: manifests.length,
    new: newCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    errors: errorCount,
    results,
    dryRun: options.dryRun ?? false,
  };

  // Output results
  if (options.json) {
    console.log(JSON.stringify(syncResult, null, 2));
  } else {
    if (manifests.length === 0) {
      console.log('No pai-manifest.yaml files found to sync.');
      console.log('');
      console.log('Searched:', validRoots.join(', '));
    } else {
      const prefix = options.dryRun ? '[DRY RUN] Would sync' : 'Synced';
      console.log(`${prefix} ${manifests.length} manifest${manifests.length === 1 ? '' : 's'}:`);
      console.log(`  - ${newCount} new`);
      console.log(`  - ${updatedCount} updated`);
      console.log(`  - ${unchangedCount} unchanged`);
      if (errorCount > 0) {
        console.log(`  - ${errorCount} error${errorCount === 1 ? '' : 's'}`);
      }
      console.log('');

      // Show errors if any
      const errors = results.filter(r => r.status === 'error');
      if (errors.length > 0) {
        console.log('Errors:');
        for (const err of errors) {
          console.log(`  ${err.path}: ${err.error}`);
        }
        console.log('');
      }

      // Show registered tools
      const successful = results.filter(r => r.status !== 'error');
      if (successful.length > 0 && !options.dryRun) {
        console.log('Registered tools:');
        for (const r of successful) {
          const status = r.status === 'new' ? '(new)' : '(updated)';
          console.log(`  ${r.name ?? 'unknown'} ${status}`);
        }
      }
    }
  }

  return syncResult;
}

/**
 * Collect multiple values for an option
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Register the 'sync' command with the program
 */
export function syncCommand(program: Command): void {
  program
    .command('sync [roots...]')
    .description('Discover and register all pai-manifest.yaml files')
    .option('-i, --include <dir>', 'Additional directory to search (repeatable)', collect, [])
    .option('-e, --exclude <pattern>', 'Pattern to exclude (repeatable)', collect, [])
    .option('-d, --max-depth <n>', 'Maximum depth to search (default: 10)')
    .option('--no-gitignore', 'Ignore .gitignore files')
    .option('-f, --force', 'Force re-register even if unchanged')
    .option('--dry-run', 'Show what would be synced without making changes')
    .action(async (roots: string[], options: SyncCLIOptions) => {
      const globalOpts = getGlobalOptions();

      await executeSync(roots, {
        include: options.include,
        exclude: options.exclude,
        maxDepth: options.maxDepth ? parseInt(options.maxDepth, 10) : undefined,
        noGitignore: options.noGitignore,
        force: options.force,
        dryRun: options.dryRun,
        json: globalOpts.json,
      });
    });
}
