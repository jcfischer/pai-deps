/**
 * Affected command for pai-deps
 *
 * Shows tools transitively affected by changes to a given tool.
 * Answers "what needs retesting if I change this tool?"
 *
 * Similar to `rdeps --transitive` but with inverted defaults:
 * - affected defaults to transitive
 * - affected --direct shows only immediate dependents
 */

import type { Command } from 'commander';
import { getDb } from '../db/index.js';
import { DependencyGraph, type ToolNode } from '../lib/graph/index.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';
import { formatTable } from '../lib/table.js';

/**
 * Options for affected command
 */
interface AffectedOptions {
  direct?: boolean;
}

/**
 * Affected tool info with depth
 */
interface AffectedInfo {
  id: string;
  name: string;
  type: string;
  reliability: number;
  depth: number;
}

/**
 * JSON output format
 */
interface AffectedJsonOutput {
  success: boolean;
  error?: string | undefined;
  tool?: string | undefined;
  direct?: boolean | undefined;
  affected?: AffectedInfo[] | undefined;
  count?: number | undefined;
  maxDepth?: number | undefined;
}

/**
 * Calculate transitive dependents with depth using BFS
 */
function getAffectedWithDepth(
  graph: DependencyGraph,
  startId: string
): AffectedInfo[] {
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

    for (const next of graph.getDependents(current)) {
      // Exclude start node from results (handles cycles)
      if (next.id !== startId && !depths.has(next.id)) {
        depths.set(next.id, depth + 1);
        queue.push([next.id, depth + 1]);
      }
    }
  }

  // Build result with nodes and depths
  const result: AffectedInfo[] = [];
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
  return result.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
}

/**
 * Convert ToolNode to AffectedInfo with depth 1
 */
function nodeToAffectedInfo(node: ToolNode): AffectedInfo {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    reliability: node.reliability,
    depth: 1,
  };
}

/**
 * Register the 'affected' command with the program
 */
export function affectedCommand(program: Command): void {
  program
    .command('affected <tool>')
    .description('Show tools affected by changes (transitive by default)')
    .option('-d, --direct', 'Only show directly affected tools')
    .action(async (toolId: string, options: AffectedOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        // Load dependency graph
        const graph = await DependencyGraph.load(db);

        // Check if tool exists
        if (!graph.hasNode(toolId)) {
          if (opts.json) {
            const output: AffectedJsonOutput = {
              success: false,
              error: `Tool '${toolId}' not found`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Tool '${toolId}' not found`);
          }
          process.exit(1);
        }

        // Get affected tools
        let affected: AffectedInfo[];
        let maxDepth = 1;

        if (options.direct) {
          // Direct only - no transitive traversal
          affected = graph.getDependents(toolId).map(nodeToAffectedInfo);
        } else {
          // Default: transitive
          affected = getAffectedWithDepth(graph, toolId);
          maxDepth = affected.reduce((max, a) => Math.max(max, a.depth), 1);
        }

        // JSON output
        if (opts.json) {
          const output: AffectedJsonOutput = {
            success: true,
            tool: toolId,
            direct: options.direct ?? false,
            affected,
            count: affected.length,
          };
          if (!options.direct && affected.length > 0) {
            output.maxDepth = maxDepth;
          }
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Human-readable output
        if (affected.length === 0) {
          console.log(`No tools are affected by changes to '${toolId}'.`);
          return;
        }

        const header = options.direct
          ? `Tools directly affected by: ${toolId}`
          : `Tools affected by changes to: ${toolId}`;

        console.log(header);
        console.log();

        // Build table
        const headers = options.direct
          ? ['ID', 'Name', 'Type', 'Reliability']
          : ['ID', 'Name', 'Type', 'Reliability', 'Depth'];

        const rows = affected.map((a) =>
          options.direct
            ? [a.id, a.name, a.type, a.reliability.toFixed(2)]
            : [a.id, a.name, a.type, a.reliability.toFixed(2), String(a.depth)]
        );

        console.log(formatTable(headers, rows));
        console.log();

        if (options.direct) {
          console.log(`Total: ${affected.length} affected tools`);
        } else {
          console.log(
            `Total: ${affected.length} affected tools (max depth: ${maxDepth})`
          );
        }
      } catch (err) {
        if (opts.json) {
          const output: AffectedJsonOutput = {
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
