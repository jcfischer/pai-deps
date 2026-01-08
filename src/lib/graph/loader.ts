/**
 * Database loader for the dependency graph
 *
 * Loads tools and dependencies from the database into
 * in-memory data structures for efficient graph operations.
 */

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '../../db/schema.js';
import { tools, dependencies } from '../../db/schema.js';
import type { ToolNode, DependencyEdge } from './types.js';
import type { ToolType, DependencyType } from '../../types.js';

/** Database type alias */
export type DbType = BunSQLiteDatabase<typeof schema>;

/**
 * Result of loading graph data from the database
 */
export interface LoadGraphResult {
  /** Map of tool ID to ToolNode */
  nodes: Map<string, ToolNode>;
  /** Map of "from:to" key to DependencyEdge */
  edges: Map<string, DependencyEdge>;
  /** Forward adjacency list (tool -> its dependencies) */
  forward: Map<string, Set<string>>;
  /** Reverse adjacency list (tool -> tools that depend on it) */
  reverse: Map<string, Set<string>>;
}

/**
 * Load all graph data from the database.
 *
 * Queries all tools and dependencies, then builds:
 * - Node map for quick tool lookup
 * - Edge map for quick edge lookup
 * - Forward adjacency list (tool -> dependencies)
 * - Reverse adjacency list (tool -> dependents)
 *
 * @param db - Drizzle database instance
 * @returns Graph data structures
 */
export async function loadGraphData(db: DbType): Promise<LoadGraphResult> {
  const nodes = new Map<string, ToolNode>();
  const edges = new Map<string, DependencyEdge>();
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  // Load all tools
  const allTools = db.select().from(tools).all();

  for (const tool of allTools) {
    const node: ToolNode = {
      id: tool.id,
      name: tool.name,
      type: tool.type as ToolType,
      reliability: tool.reliability ?? 0.95,
      debtScore: tool.debtScore ?? 0,
      stub: tool.stub === 1,
    };
    if (tool.version) {
      node.version = tool.version;
    }

    nodes.set(tool.id, node);
    forward.set(tool.id, new Set<string>());
    reverse.set(tool.id, new Set<string>());
  }

  // Load all dependencies
  const allDeps = db.select().from(dependencies).all();

  for (const dep of allDeps) {
    // Skip edges with missing nodes (dangling references)
    if (!nodes.has(dep.consumerId) || !nodes.has(dep.providerId)) {
      continue;
    }

    const edge: DependencyEdge = {
      from: dep.consumerId,
      to: dep.providerId,
      type: dep.type as DependencyType,
      optional: dep.optional === 1,
    };
    if (dep.versionConstraint) {
      edge.version = dep.versionConstraint;
    }

    const edgeKey = `${dep.consumerId}:${dep.providerId}`;
    edges.set(edgeKey, edge);

    // Update adjacency lists
    forward.get(dep.consumerId)?.add(dep.providerId);
    reverse.get(dep.providerId)?.add(dep.consumerId);
  }

  return { nodes, edges, forward, reverse };
}
