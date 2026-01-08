/**
 * Deps command for pai-deps
 *
 * Shows forward dependencies - tools that a given tool depends on.
 * Supports both direct and transitive dependency queries.
 */

import type { Command } from 'commander';
import { getDb } from '../db/index.js';
import { DependencyGraph, type ToolNode } from '../lib/graph/index.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';
import { formatTable } from '../lib/table.js';

/**
 * Options for deps command
 */
interface DepsOptions {
  transitive?: boolean;
}

/**
 * Dependency info with optional depth
 */
interface DependencyInfo {
  id: string;
  name: string;
  type: string;
  reliability: number;
  depth?: number;
}

/**
 * JSON output format
 */
interface DepsJsonOutput {
  success: boolean;
  error?: string;
  tool?: string;
  transitive?: boolean;
  dependencies?: DependencyInfo[];
  count?: number;
  maxDepth?: number;
}

/**
 * Calculate transitive dependencies with depth using BFS
 */
function getTransitiveWithDepth(
  graph: DependencyGraph,
  startId: string
): DependencyInfo[] {
  const depths = new Map<string, number>();
  const queue: [string, number][] = [];

  // Start with direct dependencies at depth 1
  for (const dep of graph.getDependencies(startId)) {
    queue.push([dep.id, 1]);
    depths.set(dep.id, 1);
  }

  // BFS to find all reachable with minimum depths
  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;
    for (const next of graph.getDependencies(current)) {
      if (!depths.has(next.id)) {
        depths.set(next.id, depth + 1);
        queue.push([next.id, depth + 1]);
      }
    }
  }

  // Build result with nodes and depths
  const result: DependencyInfo[] = [];
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
 * Convert ToolNode to DependencyInfo
 */
function nodeToInfo(node: ToolNode): DependencyInfo {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    reliability: node.reliability,
  };
}

/**
 * Register the 'deps' command with the program
 */
export function depsCommand(program: Command): void {
  program
    .command('deps <tool>')
    .description('Show forward dependencies (what a tool depends on)')
    .option('-t, --transitive', 'Include transitive dependencies')
    .action(async (toolId: string, options: DepsOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        // Load dependency graph
        const graph = await DependencyGraph.load(db);

        // Check if tool exists
        if (!graph.hasNode(toolId)) {
          if (opts.json) {
            const output: DepsJsonOutput = {
              success: false,
              error: `Tool '${toolId}' not found`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Tool '${toolId}' not found`);
          }
          process.exit(1);
        }

        // Get dependencies
        let deps: DependencyInfo[];
        let maxDepth = 1;

        if (options.transitive) {
          deps = getTransitiveWithDepth(graph, toolId);
          maxDepth = deps.reduce((max, d) => Math.max(max, d.depth ?? 1), 1);
        } else {
          deps = graph.getDependencies(toolId).map(nodeToInfo);
        }

        // JSON output
        if (opts.json) {
          const output: DepsJsonOutput = {
            success: true,
            tool: toolId,
            transitive: options.transitive ?? false,
            dependencies: deps,
            count: deps.length,
          };
          if (options.transitive) {
            output.maxDepth = maxDepth;
          }
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Human-readable output
        if (deps.length === 0) {
          console.log(`Tool '${toolId}' has no dependencies.`);
          return;
        }

        const header = options.transitive
          ? `Dependencies for: ${toolId} (transitive)`
          : `Dependencies for: ${toolId}`;

        console.log(header);
        console.log();

        // Build table
        const headers = options.transitive
          ? ['ID', 'Name', 'Type', 'Reliability', 'Depth']
          : ['ID', 'Name', 'Type', 'Reliability'];

        const rows = deps.map((d) =>
          options.transitive
            ? [d.id, d.name, d.type, d.reliability.toFixed(2), String(d.depth)]
            : [d.id, d.name, d.type, d.reliability.toFixed(2)]
        );

        console.log(formatTable(headers, rows));
        console.log();

        if (options.transitive) {
          console.log(`Total: ${deps.length} dependencies (max depth: ${maxDepth})`);
        } else {
          console.log(`Total: ${deps.length} dependencies`);
        }
      } catch (err) {
        if (opts.json) {
          const output: DepsJsonOutput = {
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
