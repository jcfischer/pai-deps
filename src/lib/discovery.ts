/**
 * Manifest discovery - recursively find pai-manifest.yaml files
 *
 * Used by discover and sync commands to find all PAI tool manifests
 * across multiple directories.
 */

import { readdirSync, readFileSync, realpathSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import ignore, { type Ignore } from 'ignore';

/**
 * Options for manifest discovery
 */
export interface DiscoveryOptions {
  /** Directories to search (default: ['~/work']) */
  roots: string[];
  /** Additional patterns to exclude (e.g., 'test-*') */
  exclude: string[];
  /** Maximum directory depth (default: 10) */
  maxDepth: number;
  /** Whether to respect .gitignore files (default: true) */
  respectGitignore: boolean;
}

/**
 * Information about a discovered manifest
 */
export interface DiscoveredManifest {
  /** Full path to pai-manifest.yaml */
  path: string;
  /** Directory containing the manifest */
  dir: string;
  /** Tool name extracted from manifest (if readable) */
  name: string | null;
  /** Error if manifest couldn't be read */
  error?: string;
}

/**
 * Default directory patterns to always exclude
 */
const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.next',
  '.turbo',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
];

/**
 * Maximum entries in a directory before skipping (likely unintended large dir)
 */
const MAX_DIR_ENTRIES = 1000;

/**
 * Manifest filename to search for
 */
const MANIFEST_FILENAME = 'pai-manifest.yaml';

/**
 * Extract tool name from manifest content
 */
function extractToolName(manifestPath: string): string | null {
  try {
    const content = readFileSync(manifestPath, 'utf-8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    return nameMatch ? nameMatch[1]!.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Load .gitignore patterns from a directory
 */
function loadGitignore(dir: string): string[] {
  const gitignorePath = join(dir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    return [];
  }
  try {
    const content = readFileSync(gitignorePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

/**
 * Recursively discover pai-manifest.yaml files
 *
 * @param options - Discovery options
 * @returns Array of discovered manifests
 */
export async function discoverManifests(
  options: Partial<DiscoveryOptions> = {}
): Promise<DiscoveredManifest[]> {
  const opts: DiscoveryOptions = {
    roots: options.roots ?? [join(process.env.HOME ?? '~', 'work')],
    exclude: options.exclude ?? [],
    maxDepth: options.maxDepth ?? 10,
    respectGitignore: options.respectGitignore ?? true,
  };

  const results: DiscoveredManifest[] = [];
  const visited = new Set<string>(); // Track visited directories by realpath

  // Create base ignore instance with default + custom excludes
  const baseIgnore = ignore().add(DEFAULT_EXCLUDES).add(opts.exclude);

  for (const root of opts.roots) {
    const resolvedRoot = resolve(root.replace(/^~/, process.env.HOME ?? ''));

    if (!existsSync(resolvedRoot)) {
      continue; // Skip non-existent roots
    }

    walkDirectory(
      resolvedRoot,
      resolvedRoot,
      0,
      opts.maxDepth,
      opts.respectGitignore,
      baseIgnore,
      visited,
      results
    );
  }

  return results;
}

/**
 * Walk a directory recursively looking for manifests
 */
function walkDirectory(
  dir: string,
  root: string,
  depth: number,
  maxDepth: number,
  respectGitignore: boolean,
  parentIgnore: Ignore,
  visited: Set<string>,
  results: DiscoveredManifest[]
): void {
  // Check depth limit
  if (depth > maxDepth) {
    return;
  }

  // Resolve real path to handle symlinks
  let realDir: string;
  try {
    realDir = realpathSync(dir);
  } catch {
    return; // Can't resolve, skip
  }

  // Check for symlink loops
  if (visited.has(realDir)) {
    return;
  }
  visited.add(realDir);

  // Load gitignore patterns at this level
  let currentIgnore = parentIgnore;
  if (respectGitignore) {
    const gitignorePatterns = loadGitignore(dir);
    if (gitignorePatterns.length > 0) {
      currentIgnore = ignore().add(parentIgnore).add(gitignorePatterns);
    }
  }

  // Read directory entries
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Permission denied or other error, skip
  }

  // Skip very large directories (likely unintended)
  if (entries.length > MAX_DIR_ENTRIES) {
    return;
  }

  // Check for manifest in current directory
  const manifestPath = join(dir, MANIFEST_FILENAME);
  if (existsSync(manifestPath)) {
    const name = extractToolName(manifestPath);
    results.push({
      path: manifestPath,
      dir,
      name,
    });
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryName = entry.name;
    const relativePath = relative(root, join(dir, entryName));

    // Check if this directory should be ignored
    if (currentIgnore.ignores(entryName) || currentIgnore.ignores(relativePath + '/')) {
      continue;
    }

    walkDirectory(
      join(dir, entryName),
      root,
      depth + 1,
      maxDepth,
      respectGitignore,
      currentIgnore,
      visited,
      results
    );
  }
}

/**
 * Get default discovery options
 */
export function getDefaultRoots(): string[] {
  const home = process.env.HOME ?? '~';
  return [
    join(home, 'work'),
    join(home, '.claude', 'skills'),
  ];
}
