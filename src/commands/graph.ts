/**
 * Graph command for pai-deps
 *
 * Generates DOT format output from the dependency graph.
 * Optionally renders to SVG using Graphviz.
 */

import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getDb } from '../db/index.js';
import { DependencyGraph } from '../lib/graph/index.js';
import { generateDot, type DotOptions } from '../lib/dot.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';

/**
 * Options for graph command
 */
interface GraphOptions {
  output?: string;
  format?: 'dot' | 'svg';
  focus?: string;
  depth?: string;
  noColor?: boolean;
}

/**
 * JSON output format
 */
interface GraphJsonOutput {
  success: boolean;
  error?: string;
  format?: string;
  dot?: string;
  outputFile?: string;
}

/**
 * Check if Graphviz is installed
 */
function hasGraphviz(): boolean {
  const result = spawnSync('which', ['dot'], { encoding: 'utf-8' });
  return result.status === 0;
}

/**
 * Render DOT to SVG using Graphviz
 */
function renderSvg(dot: string): string {
  const result = spawnSync('dot', ['-Tsvg'], {
    input: dot,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });

  if (result.status !== 0) {
    throw new Error(`Graphviz error: ${result.stderr || 'Unknown error'}`);
  }

  return result.stdout;
}

/**
 * Register the 'graph' command with the program
 */
export function graphCommand(program: Command): void {
  program
    .command('graph')
    .description('Generate DOT/SVG graph of dependencies')
    .option('-o, --output <file>', 'Write to file instead of stdout')
    .option('-f, --format <fmt>', 'Output format: dot (default) or svg', 'dot')
    .option('--focus <tool>', 'Generate subgraph centered on a tool')
    .option('--depth <n>', 'Max depth from focus tool (default: 3)', '3')
    .option('--no-color', 'Disable node coloring')
    .action(async (options: GraphOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        // Load dependency graph
        const graph = await DependencyGraph.load(db);

        // Build DOT options
        const dotOptions: DotOptions = {
          rankdir: 'LR',
          noColor: options.noColor ?? false,
        };

        if (options.focus) {
          dotOptions.focusId = options.focus;
          dotOptions.maxDepth = options.depth
            ? parseInt(options.depth, 10)
            : 3;
        }

        // Generate DOT
        const dot = generateDot(graph, dotOptions);

        // Determine output format
        const format = options.format || 'dot';
        let output = dot;

        if (format === 'svg') {
          if (!hasGraphviz()) {
            const errorMsg =
              'Graphviz not installed. Install with: brew install graphviz';
            if (opts.json) {
              const jsonOutput: GraphJsonOutput = {
                success: false,
                error: errorMsg,
              };
              console.log(JSON.stringify(jsonOutput, null, 2));
            } else {
              logError(errorMsg);
            }
            process.exit(1);
          }
          output = renderSvg(dot);
        }

        // JSON output
        if (opts.json) {
          const jsonOutput: GraphJsonOutput = {
            success: true,
            format,
            dot: format === 'dot' ? output : dot,
          };
          if (options.output) {
            jsonOutput.outputFile = options.output;
          }
          console.log(JSON.stringify(jsonOutput, null, 2));

          // Still write to file if specified
          if (options.output) {
            writeFileSync(options.output, output);
          }
          return;
        }

        // Write output
        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`Graph written to: ${options.output}`);
        } else {
          console.log(output);
        }
      } catch (err) {
        if (opts.json) {
          const jsonOutput: GraphJsonOutput = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
          console.log(JSON.stringify(jsonOutput, null, 2));
        } else {
          logError(err instanceof Error ? err.message : String(err));
        }
        process.exit(1);
      }
    });
}
