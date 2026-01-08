/**
 * Path command for pai-deps
 *
 * Finds the shortest dependency path between two tools.
 */

import type { Command } from 'commander';
import { getDb } from '../db/index.js';
import { DependencyGraph } from '../lib/graph/index.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';

/**
 * JSON output format
 */
interface PathJsonOutput {
  success: boolean;
  error?: string;
  from?: string;
  to?: string;
  path?: string[];
  length?: number;
}

/**
 * Format a path as arrow notation
 */
function formatPath(path: string[]): string {
  return path.join(' → ');
}

/**
 * Register the 'path' command with the program
 */
export function pathCommand(program: Command): void {
  program
    .command('path <from> <to>')
    .description('Find shortest dependency path between two tools')
    .action(async (from: string, to: string) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        // Load dependency graph
        const graph = await DependencyGraph.load(db);

        // Validate tools exist
        if (!graph.hasNode(from)) {
          if (opts.json) {
            const output: PathJsonOutput = {
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
            const output: PathJsonOutput = {
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
            const output: PathJsonOutput = {
              success: true,
              from,
              to,
              path: [from],
              length: 0,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            console.log(`Source and target are the same tool: ${from}`);
          }
          return;
        }

        // Find shortest path
        const path = graph.findPath(from, to);

        if (!path) {
          if (opts.json) {
            const output: PathJsonOutput = {
              success: false,
              from,
              to,
              error: `No dependency path from '${from}' to '${to}'`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            console.log(`No dependency path from '${from}' to '${to}'.`);
          }
          process.exit(1);
        }

        // JSON output
        if (opts.json) {
          const output: PathJsonOutput = {
            success: true,
            from,
            to,
            path,
            length: path.length - 1,
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Human-readable output
        console.log(`Path from ${from} to ${to}:`);
        console.log();
        console.log(`  ${formatPath(path)}`);
        console.log();
        console.log(`Length: ${path.length - 1} hop${path.length - 1 === 1 ? '' : 's'}`);
      } catch (err) {
        if (opts.json) {
          const output: PathJsonOutput = {
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
