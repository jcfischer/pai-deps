/**
 * Type definitions for the in-memory dependency graph
 *
 * These types represent the graph structure used for dependency analysis,
 * cycle detection, topological sorting, and path finding.
 */

import type { ToolType, DependencyType } from '../../types.js';

/**
 * A node in the dependency graph representing a tool
 */
export interface ToolNode {
  /** Unique identifier (e.g., "email", "tana-mcp") */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Tool type: cli | mcp | skill | library | service */
  type: ToolType;
  /** Semantic version (optional) */
  version?: string;
  /** Reliability score 0.0-1.0 */
  reliability: number;
  /** Technical debt score */
  debtScore: number;
  /** Whether this is an auto-created stub entry */
  stub: boolean;
}

/**
 * An edge in the dependency graph representing a dependency relationship
 */
export interface DependencyEdge {
  /** ID of the tool that has the dependency (consumer) */
  from: string;
  /** ID of the tool being depended on (provider) */
  to: string;
  /** Type of dependency: runtime | build | optional | peer */
  type: DependencyType;
  /** Version constraint (optional) */
  version?: string;
  /** Whether this is an optional dependency */
  optional: boolean;
}

/**
 * JSON serialization format for the graph
 */
export interface GraphJSON {
  /** All nodes in the graph */
  nodes: ToolNode[];
  /** All edges in the graph */
  edges: DependencyEdge[];
  /** Graph metadata */
  metadata: {
    /** Number of nodes */
    nodeCount: number;
    /** Number of edges */
    edgeCount: number;
    /** ISO timestamp when graph was loaded */
    loadedAt: string;
  };
}
