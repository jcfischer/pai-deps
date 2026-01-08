/**
 * DOT graph generation for pai-deps
 *
 * Generates Graphviz DOT format output from the dependency graph.
 */

import type { DependencyGraph } from './graph/index.js';

/**
 * Options for DOT generation
 */
export interface DotOptions {
  /** Graph direction: LR (left-right) or TB (top-bottom) */
  rankdir?: 'LR' | 'TB';
  /** Focus on a specific tool and its neighborhood */
  focusId?: string;
  /** Maximum depth from focus tool */
  maxDepth?: number;
  /** Disable node coloring */
  noColor?: boolean;
}

/**
 * Color scheme for node types
 */
const NODE_COLORS: Record<string, string> = {
  library: '#e1f5fe', // Light blue
  cli: '#e8f5e9', // Light green
  mcp: '#f3e5f5', // Light purple
  stub: '#eeeeee', // Light gray
};

/**
 * Escape a string for use as a DOT identifier
 */
function escapeId(id: string): string {
  // Replace hyphens and other special chars with underscores
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Escape a string for use in a DOT label
 */
function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Get the fill color for a node based on its type
 */
function getNodeColor(type: string, isStub: boolean): string {
  if (isStub) return NODE_COLORS['stub'] ?? '#eeeeee';
  return NODE_COLORS[type] ?? '#ffffff';
}

/**
 * Get nodes within a certain depth from a focus node (both directions)
 */
function getSubgraphNodes(
  graph: DependencyGraph,
  focusId: string,
  maxDepth: number
): Set<string> {
  const nodes = new Set<string>();
  nodes.add(focusId);

  // BFS forward (dependencies - what focus depends on)
  const forwardQueue: [string, number][] = [[focusId, 0]];
  const forwardVisited = new Set<string>([focusId]);

  while (forwardQueue.length > 0) {
    const [current, depth] = forwardQueue.shift()!;
    if (depth >= maxDepth) continue;

    for (const dep of graph.getDependencies(current)) {
      if (!forwardVisited.has(dep.id)) {
        forwardVisited.add(dep.id);
        nodes.add(dep.id);
        forwardQueue.push([dep.id, depth + 1]);
      }
    }
  }

  // BFS backward (dependents - what depends on focus)
  const backwardQueue: [string, number][] = [[focusId, 0]];
  const backwardVisited = new Set<string>([focusId]);

  while (backwardQueue.length > 0) {
    const [current, depth] = backwardQueue.shift()!;
    if (depth >= maxDepth) continue;

    for (const dep of graph.getDependents(current)) {
      if (!backwardVisited.has(dep.id)) {
        backwardVisited.add(dep.id);
        nodes.add(dep.id);
        backwardQueue.push([dep.id, depth + 1]);
      }
    }
  }

  return nodes;
}

/**
 * Generate DOT format output from the dependency graph
 */
export function generateDot(
  graph: DependencyGraph,
  options: DotOptions = {}
): string {
  const { rankdir = 'LR', focusId, maxDepth = 3, noColor = false } = options;

  const lines: string[] = [];

  // Header
  lines.push('digraph pai_deps {');
  lines.push(`  rankdir=${rankdir};`);
  lines.push('  node [shape=box fontname="Arial" fontsize=10];');
  lines.push('  edge [fontname="Arial" fontsize=9];');
  lines.push('');

  // Get nodes to include
  let nodesToInclude: Set<string>;
  if (focusId) {
    if (!graph.hasNode(focusId)) {
      throw new Error(`Tool '${focusId}' not found`);
    }
    nodesToInclude = getSubgraphNodes(graph, focusId, maxDepth);
  } else {
    nodesToInclude = new Set(graph.getAllNodes().map((n) => n.id));
  }

  // If empty graph
  if (nodesToInclude.size === 0) {
    lines.push('  // Empty graph - no tools registered');
    lines.push('}');
    return lines.join('\n');
  }

  // Generate node declarations
  lines.push('  // Nodes');
  const allNodes = graph.getAllNodes();
  for (const node of allNodes) {
    if (!nodesToInclude.has(node.id)) continue;

    const escapedId = escapeId(node.id);
    const label = escapeLabel(`${node.name}\\n(${node.type})`);
    const color = noColor ? '#ffffff' : getNodeColor(node.type, node.stub);
    const style = node.stub ? 'filled,dashed' : 'filled';
    const penwidth = focusId === node.id ? '2' : '1';
    const peripheries = focusId === node.id ? '2' : '1';

    lines.push(
      `  ${escapedId} [label="${label}" style="${style}" fillcolor="${color}" penwidth=${penwidth} peripheries=${peripheries}];`
    );
  }

  lines.push('');

  // Generate edges
  lines.push('  // Edges');
  const edges = graph.getAllEdges();
  for (const edge of edges) {
    // Only include edges where both nodes are in the subgraph
    if (
      !nodesToInclude.has(edge.from) ||
      !nodesToInclude.has(edge.to)
    ) {
      continue;
    }

    const fromId = escapeId(edge.from);
    const toId = escapeId(edge.to);

    // Check for potential circular dependency (simple heuristic)
    const isCircular =
      graph.getDependencies(edge.to).some((d) => d.id === edge.from);

    if (isCircular) {
      lines.push(`  ${fromId} -> ${toId} [color="red" style="dashed"];`);
    } else {
      lines.push(`  ${fromId} -> ${toId};`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}
