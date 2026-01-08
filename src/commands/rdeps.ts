/**
 * Rdeps command for pai-deps
 *
 * Shows reverse dependencies - tools that depend on a given tool.
 * Answers "what breaks if I change this tool?"
 */

import type { Command } from 'commander';
import { getDb } from '../db/index.js';
import { DependencyGraph, type ToolNode } from '../lib/graph/index.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';
import { formatTable } from '../lib/table.js';

/**
 * Options for rdeps command
 */
interface RdepsOptions {
  transitive?: boolean;
  depth?: string;
}

/**
 * Dependent info with depth
 */
interface DependentInfo {
  id: string;
  name: string;
  type: string;
  reliability: number;
  depth?: number;
}

/**
 * JSON output format
 */
interface RdepsJsonOutput {
  success: boolean;
  error?: string;
  tool?: string;
  transitive?: boolean;
  dependents?: DependentInfo[];
  count?: number;
  maxDepth?: number;
}

/**
 * Calculate transitive dependents with depth using BFS on reverse adjacency
 */
function getTransitiveDependentsWithDepth(
  graph: DependencyGraph,
  startId: string,
  maxDepth?: number
): DependentInfo[] {
  const depths = new Map<string, number>();
  const queue: [string, number][] = [];

  // Start with direct dependents at depth 1
  for (const dep of graph.getDependents(startId)) {
    queue.push([dep.id, 1]);
    depths.set(dep.id, 1);
  }

  // BFS to find all dependents with minimum depths
  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;

    // Skip if we've exceeded max depth
    if (maxDepth !== undefined && depth >= maxDepth) {
      continue;
    }

    for (const next of graph.getDependents(current)) {
      // Exclude start node from results (handles cycles)
      if (next.id !== startId && !depths.has(next.id)) {
        depths.set(next.id, depth + 1);
        queue.push([next.id, depth + 1]);
      }
    }
  }

  // Build result with nodes and depths
  const result: DependentInfo[] = [];
  for (const [id, depth] of depths) {
    const node = graph.getNode(id);
    if (node) {
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        reliability: node.reliability,
        depth,
      });
    }
  }

  // Sort by depth, then by name
  return result.sort((a, b) =>
    (a.depth ?? 0) - (b.depth ?? 0) || a.name.localeCompare(b.name)
  );
}

/**
 * Convert ToolNode to DependentInfo
 */
function nodeToInfo(node: ToolNode): DependentInfo {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    reliability: node.reliability,
  };
}

/**
 * Register the 'rdeps' command with the program
 */
export function rdepsCommand(program: Command): void {
  program
    .command('rdeps <tool>')
    .description('Show reverse dependencies (tools that depend on this one)')
    .option('-t, --transitive', 'Include transitive dependents')
    .option('-d, --depth <n>', 'Maximum depth (requires --transitive)')
    .action(async (toolId: string, options: RdepsOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        // Load dependency graph
        const graph = await DependencyGraph.load(db);

        // Check if tool exists
        if (!graph.hasNode(toolId)) {
          if (opts.json) {
            const output: RdepsJsonOutput = {
              success: false,
              error: `Tool '${toolId}' not found`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Tool '${toolId}' not found`);
          }
          process.exit(1);
        }

        // Get dependents
        let dependents: DependentInfo[];
        let maxDepth = 1;

        if (options.transitive) {
          const depthLimit = options.depth ? parseInt(options.depth, 10) : undefined;
          dependents = getTransitiveDependentsWithDepth(graph, toolId, depthLimit);
          maxDepth = dependents.reduce((max, d) => Math.max(max, d.depth ?? 1), 1);
        } else {
          dependents = graph.getDependents(toolId).map(nodeToInfo);
        }

        // JSON output
        if (opts.json) {
          const output: RdepsJsonOutput = {
            success: true,
            tool: toolId,
            transitive: options.transitive ?? false,
            dependents,
            count: dependents.length,
          };
          if (options.transitive) {
            output.maxDepth = maxDepth;
          }
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Human-readable output
        if (dependents.length === 0) {
          console.log(`No tools depend on '${toolId}'.`);
          return;
        }

        const header = options.transitive
          ? `Reverse dependencies for: ${toolId} (transitive)`
          : `Reverse dependencies for: ${toolId}`;

        console.log(header);
        console.log();

        // Build table
        const headers = options.transitive
          ? ['ID', 'Name', 'Type', 'Reliability', 'Depth']
          : ['ID', 'Name', 'Type', 'Reliability'];

        const rows = dependents.map((d) =>
          options.transitive
            ? [d.id, d.name, d.type, d.reliability.toFixed(2), String(d.depth)]
            : [d.id, d.name, d.type, d.reliability.toFixed(2)]
        );

        console.log(formatTable(headers, rows));
        console.log();

        if (options.transitive) {
          console.log(`Total: ${dependents.length} dependents (max depth: ${maxDepth})`);
        } else {
          console.log(`Total: ${dependents.length} dependents`);
        }
      } catch (err) {
        if (opts.json) {
          const output: RdepsJsonOutput = {
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
