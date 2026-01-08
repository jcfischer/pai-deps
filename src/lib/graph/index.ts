/**
 * DependencyGraph - In-memory dependency graph for efficient traversal
 *
 * Provides O(1) neighbor lookups, cycle detection, topological sorting,
 * and path finding for the tool dependency graph.
 */

import type { ToolNode, DependencyEdge, GraphJSON } from './types.js';
import { loadGraphData, type DbType } from './loader.js';
import {
  findCycles as detectCycles,
  topologicalSort as topoSort,
  findPath as bfsPath,
  findAllPaths as dfsAllPaths,
  getTransitiveClosure,
} from './algorithms.js';

// Re-export types
export type { ToolNode, DependencyEdge, GraphJSON } from './types.js';
export type { DbType } from './loader.js';

/**
 * In-memory dependency graph with adjacency list representation.
 *
 * Loads tools and dependencies from the database into efficient
 * data structures for graph traversal and analysis.
 */
export class DependencyGraph {
  /** Map of tool ID to ToolNode */
  private nodes: Map<string, ToolNode>;

  /** Map of "from:to" key to DependencyEdge */
  private edges: Map<string, DependencyEdge>;

  /** Forward adjacency list (tool -> its dependencies) */
  private forward: Map<string, Set<string>>;

  /** Reverse adjacency list (tool -> tools that depend on it) */
  private reverse: Map<string, Set<string>>;

  /** Timestamp when graph was loaded */
  private loadedAt: Date;

  /**
   * Private constructor - use DependencyGraph.load() factory method.
   */
  private constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.forward = new Map();
    this.reverse = new Map();
    this.loadedAt = new Date();
  }

  /**
   * Factory method to create a DependencyGraph from the database.
   *
   * @param db - Drizzle database instance
   * @returns Loaded DependencyGraph instance
   */
  static async load(db: DbType): Promise<DependencyGraph> {
    const graph = new DependencyGraph();
    const data = await loadGraphData(db);

    graph.nodes = data.nodes;
    graph.edges = data.edges;
    graph.forward = data.forward;
    graph.reverse = data.reverse;
    graph.loadedAt = new Date();

    return graph;
  }

  // ========== Node Access ==========

  /**
   * Get a node by ID.
   *
   * @param id - Tool ID
   * @returns ToolNode or undefined if not found
   */
  getNode(id: string): ToolNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes in the graph.
   *
   * @returns Array of all ToolNodes
   */
  getAllNodes(): ToolNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Check if a node exists.
   *
   * @param id - Tool ID
   * @returns true if node exists
   */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  // ========== Edge Access ==========

  /**
   * Get an edge by source and target IDs.
   *
   * @param from - Source tool ID (consumer)
   * @param to - Target tool ID (provider)
   * @returns DependencyEdge or undefined if not found
   */
  getEdge(from: string, to: string): DependencyEdge | undefined {
    return this.edges.get(`${from}:${to}`);
  }

  /**
   * Get all edges in the graph.
   *
   * @returns Array of all DependencyEdges
   */
  getAllEdges(): DependencyEdge[] {
    return Array.from(this.edges.values());
  }

  // ========== Forward Dependencies (tools this one depends on) ==========

  /**
   * Get direct dependencies of a tool.
   *
   * @param id - Tool ID
   * @returns Array of ToolNodes this tool depends on
   */
  getDependencies(id: string): ToolNode[] {
    const depIds = this.forward.get(id);
    if (!depIds) return [];

    const result: ToolNode[] = [];
    for (const depId of depIds) {
      const node = this.nodes.get(depId);
      if (node) result.push(node);
    }
    return result;
  }

  /**
   * Get dependency edges from a tool.
   *
   * @param id - Tool ID
   * @returns Array of DependencyEdges where this tool is the consumer
   */
  getDependencyEdges(id: string): DependencyEdge[] {
    const depIds = this.forward.get(id);
    if (!depIds) return [];

    const result: DependencyEdge[] = [];
    for (const depId of depIds) {
      const edge = this.edges.get(`${id}:${depId}`);
      if (edge) result.push(edge);
    }
    return result;
  }

  // ========== Reverse Dependencies (tools that depend on this one) ==========

  /**
   * Get tools that directly depend on this tool.
   *
   * @param id - Tool ID
   * @returns Array of ToolNodes that depend on this tool
   */
  getDependents(id: string): ToolNode[] {
    const depIds = this.reverse.get(id);
    if (!depIds) return [];

    const result: ToolNode[] = [];
    for (const depId of depIds) {
      const node = this.nodes.get(depId);
      if (node) result.push(node);
    }
    return result;
  }

  /**
   * Get dependency edges to a tool.
   *
   * @param id - Tool ID
   * @returns Array of DependencyEdges where this tool is the provider
   */
  getDependentEdges(id: string): DependencyEdge[] {
    const depIds = this.reverse.get(id);
    if (!depIds) return [];

    const result: DependencyEdge[] = [];
    for (const depId of depIds) {
      const edge = this.edges.get(`${depId}:${id}`);
      if (edge) result.push(edge);
    }
    return result;
  }

  // ========== Transitive Queries ==========

  /**
   * Get all transitive dependencies of a tool.
   *
   * @param id - Tool ID
   * @returns Array of all ToolNodes reachable via dependencies
   */
  getTransitiveDependencies(id: string): ToolNode[] {
    if (!this.hasNode(id)) return [];

    const reachable = getTransitiveClosure(id, this.forward);
    const result: ToolNode[] = [];
    for (const nodeId of reachable) {
      const node = this.nodes.get(nodeId);
      if (node) result.push(node);
    }
    return result;
  }

  /**
   * Get all tools that transitively depend on this tool.
   *
   * @param id - Tool ID
   * @returns Array of all ToolNodes that can reach this tool via dependencies
   */
  getTransitiveDependents(id: string): ToolNode[] {
    if (!this.hasNode(id)) return [];

    const reachable = getTransitiveClosure(id, this.reverse);
    const result: ToolNode[] = [];
    for (const nodeId of reachable) {
      const node = this.nodes.get(nodeId);
      if (node) result.push(node);
    }
    return result;
  }

  // ========== Path Finding ==========

  /**
   * Find the shortest path between two tools.
   *
   * @param from - Starting tool ID
   * @param to - Target tool ID
   * @returns Array of tool IDs forming the path, or null if no path exists
   */
  findPath(from: string, to: string): string[] | null {
    if (!this.hasNode(from) || !this.hasNode(to)) {
      return null;
    }
    return bfsPath(from, to, this.forward);
  }

  /**
   * Find all paths between two tools.
   *
   * @param from - Starting tool ID
   * @param to - Target tool ID
   * @param maxPaths - Maximum number of paths to find (default: 100)
   * @returns Array of paths, each path is an array of tool IDs
   */
  findAllPaths(from: string, to: string, maxPaths: number = 100): string[][] {
    if (!this.hasNode(from) || !this.hasNode(to)) {
      return [];
    }
    return dfsAllPaths(from, to, this.forward, maxPaths);
  }

  // ========== Cycle Detection ==========

  /**
   * Find all cycles in the dependency graph.
   *
   * @returns Array of cycles, each cycle is an array of tool IDs
   */
  findCycles(): string[][] {
    return detectCycles(new Set(this.nodes.keys()), this.forward);
  }

  /**
   * Check if the graph has any cycles.
   *
   * @returns true if at least one cycle exists
   */
  hasCycle(): boolean {
    return this.findCycles().length > 0;
  }

  // ========== Topological Sort ==========

  /**
   * Get tools in topological order (dependencies before dependents).
   *
   * @returns Array of tool IDs in topological order
   */
  topologicalSort(): string[] {
    return topoSort(new Set(this.nodes.keys()), this.forward);
  }

  // ========== Serialization ==========

  /**
   * Serialize the graph to JSON.
   *
   * @returns GraphJSON object
   */
  toJSON(): GraphJSON {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
      metadata: {
        nodeCount: this.nodes.size,
        edgeCount: this.edges.size,
        loadedAt: this.loadedAt.toISOString(),
      },
    };
  }

  // ========== Stats ==========

  /**
   * Get the number of nodes in the graph.
   *
   * @returns Node count
   */
  nodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get the number of edges in the graph.
   *
   * @returns Edge count
   */
  edgeCount(): number {
    return this.edges.size;
  }
}
