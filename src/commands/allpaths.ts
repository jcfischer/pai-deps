/**
 * Allpaths command for pai-deps
 *
 * Finds all dependency paths between two tools.
 */

import type { Command } from 'commander';
import { getDb } from '../db/index.js';
import { DependencyGraph } from '../lib/graph/index.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';

/**
 * Options for allpaths command
 */
interface AllpathsOptions {
  limit?: string;
}

/**
 * JSON output format
 */
interface AllpathsJsonOutput {
  success: boolean;
  error?: string;
  from?: string;
  to?: string;
  paths?: string[][];
  count?: number;
  minLength?: number;
  maxLength?: number;
}

/**
 * Format a path as arrow notation
 */
function formatPath(path: string[]): string {
  return path.join(' → ');
}

/**
 * Register the 'allpaths' command with the program
 */
export function allpathsCommand(program: Command): void {
  program
    .command('allpaths <from> <to>')
    .description('Find all dependency paths between two tools')
    .option('-l, --limit <n>', 'Maximum number of paths to return', '10')
    .action(async (from: string, to: string, options: AllpathsOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();
      const limit = options.limit ? parseInt(options.limit, 10) : 10;

      try {
        // Load dependency graph
        const graph = await DependencyGraph.load(db);

        // Validate tools exist
        if (!graph.hasNode(from)) {
          if (opts.json) {
            const output: AllpathsJsonOutput = {
              success: false,
              error: `Tool '${from}' not found`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Tool '${from}' not found`);
          }
          process.exit(1);
        }

        if (!graph.hasNode(to)) {
          if (opts.json) {
            const output: AllpathsJsonOutput = {
              success: false,
              error: `Tool '${to}' not found`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Tool '${to}' not found`);
          }
          process.exit(1);
        }

        // Check if same tool
        if (from === to) {
          if (opts.json) {
            const output: AllpathsJsonOutput = {
              success: true,
              from,
              to,
              paths: [[from]],
              count: 1,
              minLength: 0,
              maxLength: 0,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            console.log(`Source and target are the same tool: ${from}`);
          }
          return;
        }

        // Find all paths
        const paths = graph.findAllPaths(from, to, limit);

        if (paths.length === 0) {
          if (opts.json) {
            const output: AllpathsJsonOutput = {
              success: false,
              from,
              to,
              error: `No dependency paths from '${from}' to '${to}'`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            console.log(`No dependency paths from '${from}' to '${to}'.`);
          }
          process.exit(1);
        }

        // Calculate min/max lengths
        const lengths = paths.map((p) => p.length - 1);
        const minLength = Math.min(...lengths);
        const maxLength = Math.max(...lengths);

        // JSON output
        if (opts.json) {
          const output: AllpathsJsonOutput = {
            success: true,
            from,
            to,
            paths,
            count: paths.length,
            minLength,
            maxLength,
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Human-readable output
        const countStr = paths.length === limit ? `${paths.length}+ found, showing first ${limit}` : `${paths.length} found`;
        console.log(`Paths from ${from} to ${to} (${countStr}):`);
        console.log();

        paths.forEach((path, i) => {
          console.log(`  ${i + 1}. ${formatPath(path)}`);
        });

        console.log();
        if (minLength === maxLength) {
          console.log(`All paths: ${minLength} hop${minLength === 1 ? '' : 's'}`);
        } else {
          console.log(`Shortest: ${minLength} hop${minLength === 1 ? '' : 's'} | Longest: ${maxLength} hops`);
        }
      } catch (err) {
        if (opts.json) {
          const output: AllpathsJsonOutput = {
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
}
