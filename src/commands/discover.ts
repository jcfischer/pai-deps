/**
 * Discover Command
 *
 * Recursively find all pai-manifest.yaml files in specified directories.
 */

import type { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { discoverManifests, getDefaultRoots, type DiscoveredManifest } from '../lib/discovery';
import { getGlobalOptions } from '../lib/output';

/**
 * Discover command options
 */
interface DiscoverCLIOptions {
  /** Additional root directories to include */
  include?: string[];
  /** Patterns to exclude */
  exclude?: string[];
  /** Maximum depth to search */
  maxDepth?: string;
  /** Disable gitignore support */
  noGitignore?: boolean;
}

/**
 * Result of discover command
 */
export interface DiscoverResult {
  manifests: DiscoveredManifest[];
  roots: string[];
}

/**
 * Execute the discover logic
 */
export async function executeDiscover(
  roots?: string[],
  options: {
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    maxDepth?: number | undefined;
    noGitignore?: boolean | undefined;
    json?: boolean | undefined;
  } = {}
): Promise<DiscoverResult> {
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

  // Validate roots exist
  const validRoots: string[] = [];
  const invalidRoots: string[] = [];
  for (const root of searchRoots) {
    if (existsSync(root)) {
      validRoots.push(root);
    } else {
      invalidRoots.push(root);
    }
  }

  if (validRoots.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ manifests: [], roots: searchRoots, error: 'No valid roots found' }, null, 2));
    } else {
      console.error('Error: No valid root directories found.');
      console.error('Searched:', searchRoots.join(', '));
    }
    return { manifests: [], roots: searchRoots };
  }

  // Discover manifests
  const manifests = await discoverManifests({
    roots: validRoots,
    exclude: options.exclude ?? [],
    maxDepth: options.maxDepth ?? 10,
    respectGitignore: !options.noGitignore,
  });

  // Output results
  if (options.json) {
    console.log(JSON.stringify({
      manifests: manifests.map(m => ({
        path: m.path,
        dir: m.dir,
        name: m.name,
      })),
      roots: validRoots,
      count: manifests.length,
    }, null, 2));
  } else {
    if (invalidRoots.length > 0) {
      console.warn(`Warning: Skipped non-existent directories: ${invalidRoots.join(', ')}`);
      console.log('');
    }

    if (manifests.length === 0) {
      console.log('No pai-manifest.yaml files found.');
      console.log('');
      console.log('Searched directories:');
      for (const root of validRoots) {
        console.log(`  ${root}`);
      }
      console.log('');
      console.log('To create a manifest, run: pai-deps init <path>');
    } else {
      console.log(`Found ${manifests.length} pai-manifest.yaml file${manifests.length === 1 ? '' : 's'}:`);
      console.log('');
      for (const manifest of manifests) {
        const nameStr = manifest.name ? ` (${manifest.name})` : '';
        console.log(`  ${manifest.path}${nameStr}`);
      }
      console.log('');
      console.log(`Searched: ${validRoots.join(', ')}`);
    }
  }

  return { manifests, roots: validRoots };
}

/**
 * Collect multiple values for an option
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Register the 'discover' command with the program
 */
export function discoverCommand(program: Command): void {
  program
    .command('discover [roots...]')
    .description('Find all pai-manifest.yaml files in directories')
    .option('-i, --include <dir>', 'Additional directory to search (repeatable)', collect, [])
    .option('-e, --exclude <pattern>', 'Pattern to exclude (repeatable)', collect, [])
    .option('-d, --max-depth <n>', 'Maximum depth to search (default: 10)')
    .option('--no-gitignore', 'Ignore .gitignore files')
    .action(async (roots: string[], options: DiscoverCLIOptions) => {
      const globalOpts = getGlobalOptions();

      await executeDiscover(roots, {
        include: options.include,
        exclude: options.exclude,
        maxDepth: options.maxDepth ? parseInt(options.maxDepth, 10) : undefined,
        noGitignore: options.noGitignore,
        json: globalOpts.json,
      });
    });
}
