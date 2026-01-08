/**
 * Chain Reliability command for pai-deps
 *
 * Calculates compound reliability for dependency chains.
 * Compound reliability = product of all tool reliabilities in the chain.
 *
 * Example: 5 tools at 95% = 0.95^5 = 77.4% compound reliability
 */

import type { Command } from 'commander';
import { getDb } from '../db/index.js';
import { DependencyGraph } from '../lib/graph/index.js';
import { getGlobalOptions, error as logError, warn } from '../lib/output.js';
import { formatTable } from '../lib/table.js';

/**
 * Options for chain-reliability command
 */
interface ChainReliabilityOptions {
  all?: boolean;
  min?: string;
}

/**
 * Result for a single tool's chain reliability
 */
interface ChainReliabilityResult {
  id: string;
  name: string;
  reliability: number;
  compound: number;
  chainLength: number;
  chain: string[];
}

/**
 * JSON output format
 */
interface ChainReliabilityJsonOutput {
  success: boolean;
  error?: string | undefined;
  results?: ChainReliabilityResult[] | undefined;
  threshold?: number | undefined;
  belowThreshold?: ChainReliabilityResult[] | undefined;
}

/**
 * Calculate chain reliability for a tool
 */
function calculateChainReliability(
  graph: DependencyGraph,
  toolId: string
): ChainReliabilityResult | null {
  const node = graph.getNode(toolId);
  if (!node) return null;

  // Get all transitive dependencies
  const deps = graph.getTransitiveDependencies(toolId);

  // Build chain (tool + all dependencies)
  const chain = [toolId, ...deps.map((d) => d.id)];

  // Calculate compound reliability
  let compound = node.reliability;
  for (const dep of deps) {
    compound *= dep.reliability;
  }

  return {
    id: node.id,
    name: node.name,
    reliability: node.reliability,
    compound,
    chainLength: chain.length,
    chain,
  };
}

/**
 * Format percentage string
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Register the 'chain-reliability' command with the program
 */
export function chainReliabilityCommand(program: Command): void {
  program
    .command('chain-reliability [tool]')
    .description('Calculate compound reliability for dependency chains')
    .option('-a, --all', 'Calculate for all registered tools')
    .option(
      '-m, --min <threshold>',
      'Minimum acceptable reliability (0.0-1.0)',
      '0.8'
    )
    .action(async (toolId: string | undefined, options: ChainReliabilityOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        // Load dependency graph
        const graph = await DependencyGraph.load(db);

        const results: ChainReliabilityResult[] = [];
        const threshold = options.min ? parseFloat(options.min) : 0.8;

        if (options.all) {
          // Calculate for all tools
          for (const node of graph.getAllNodes()) {
            const result = calculateChainReliability(graph, node.id);
            if (result) results.push(result);
          }
        } else if (toolId) {
          // Calculate for specific tool
          if (!graph.hasNode(toolId)) {
            if (opts.json) {
              const output: ChainReliabilityJsonOutput = {
                success: false,
                error: `Tool '${toolId}' not found`,
              };
              console.log(JSON.stringify(output, null, 2));
            } else {
              logError(`Tool '${toolId}' not found`);
            }
            process.exit(1);
          }

          const result = calculateChainReliability(graph, toolId);
          if (result) results.push(result);
        } else {
          if (opts.json) {
            const output: ChainReliabilityJsonOutput = {
              success: false,
              error: 'Specify a tool ID or use --all',
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError('Specify a tool ID or use --all');
          }
          process.exit(1);
        }

        // Sort by compound reliability (lowest first to highlight risks)
        results.sort((a, b) => a.compound - b.compound);

        // Find tools below threshold
        const belowThreshold = results.filter((r) => r.compound < threshold);

        // JSON output
        if (opts.json) {
          const output: ChainReliabilityJsonOutput = {
            success: belowThreshold.length === 0,
            results,
            threshold,
          };
          if (belowThreshold.length > 0) {
            output.belowThreshold = belowThreshold;
          }
          console.log(JSON.stringify(output, null, 2));

          if (belowThreshold.length > 0) {
            process.exit(1);
          }
          return;
        }

        // Human-readable output
        if (results.length === 0) {
          console.log('No tools found.');
          return;
        }

        if (options.all) {
          console.log(`Chain Reliability Analysis (threshold: ${formatPercent(threshold)})`);
        } else {
          console.log(`Chain Reliability for: ${toolId}`);
        }
        console.log();

        // Build table
        const headers = ['ID', 'Name', 'Own', 'Compound', 'Chain Length'];
        const rows = results.map((r) => [
          r.id,
          r.name,
          formatPercent(r.reliability),
          formatPercent(r.compound),
          String(r.chainLength),
        ]);

        console.log(formatTable(headers, rows));
        console.log();

        // Show details for single tool
        if (!options.all && results.length === 1) {
          const r = results[0]!;
          console.log(`Chain: ${r.chain.join(' → ')}`);
          console.log();
        }

        // Show warnings
        if (belowThreshold.length > 0) {
          warn(`${belowThreshold.length} tool(s) below ${formatPercent(threshold)} threshold:`);
          for (const r of belowThreshold) {
            console.log(`  ${r.id}: ${formatPercent(r.compound)}`);
          }
          console.log();
          process.exit(1);
        } else {
          console.log(`All tools above ${formatPercent(threshold)} threshold.`);
        }
      } catch (err) {
        if (opts.json) {
          const output: ChainReliabilityJsonOutput = {
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
