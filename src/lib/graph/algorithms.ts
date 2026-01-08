/**
 * Pure graph algorithms for dependency analysis
 *
 * These functions operate on adjacency list representations
 * and do not depend on database access.
 */

/**
 * Detect all cycles in a directed graph using DFS with recursion stack.
 *
 * @param nodes - Set of all node IDs in the graph
 * @param forward - Forward adjacency list (node -> dependencies)
 * @returns Array of cycles, each cycle is an array of node IDs
 */
export function findCycles(
  nodes: Set<string>,
  forward: Map<string, Set<string>>
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = forward.get(node) ?? new Set<string>();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        // Found cycle - extract the cycle path
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
      }
    }

    path.pop();
    recStack.delete(node);
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Perform topological sort using Kahn's algorithm.
 *
 * Returns nodes in dependency order (dependencies before dependents).
 * If the graph has cycles, returns partial ordering.
 *
 * Note: The forward adjacency list maps tool -> its dependencies.
 * For build order (dependencies first), we need to reverse the edge direction
 * so that dependencies point to their dependents.
 *
 * @param nodes - Set of all node IDs in the graph
 * @param forward - Forward adjacency list (node -> dependencies)
 * @returns Array of node IDs in topological order (dependencies first)
 */
export function topologicalSort(
  nodes: Set<string>,
  forward: Map<string, Set<string>>
): string[] {
  // Build reverse adjacency: for each dependency, point to its dependents
  // If A depends on B (forward: A -> B), we need B -> A for topo sort
  const reverse = new Map<string, Set<string>>();
  for (const node of nodes) {
    reverse.set(node, new Set<string>());
  }
  for (const [consumer, deps] of forward) {
    for (const provider of deps) {
      reverse.get(provider)?.add(consumer);
    }
  }

  // Calculate in-degree (number of dependencies each node has)
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node, forward.get(node)?.size ?? 0);
  }

  // Start with nodes that have no dependencies (in-degree 0)
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    // For each node that depends on this one, reduce their in-degree
    const dependents = reverse.get(node) ?? new Set<string>();
    for (const dependent of dependents) {
      const newDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  return result;
}

/**
 * Find the shortest path between two nodes using BFS.
 *
 * @param from - Starting node ID
 * @param to - Target node ID
 * @param forward - Forward adjacency list
 * @returns Path as array of node IDs, or null if no path exists
 */
export function findPath(
  from: string,
  to: string,
  forward: Map<string, Set<string>>
): string[] | null {
  if (from === to) {
    return [from];
  }

  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [from];
  visited.add(from);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const neighbors = forward.get(node) ?? new Set<string>();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, node);

        if (neighbor === to) {
          // Reconstruct path
          const path: string[] = [to];
          let current = to;
          while (current !== from) {
            current = parent.get(current)!;
            path.unshift(current);
          }
          return path;
        }

        queue.push(neighbor);
      }
    }
  }

  return null;
}

/**
 * Find all paths between two nodes using DFS with backtracking.
 *
 * @param from - Starting node ID
 * @param to - Target node ID
 * @param forward - Forward adjacency list
 * @param maxPaths - Maximum number of paths to find (default: 100)
 * @returns Array of paths, each path is an array of node IDs
 */
export function findAllPaths(
  from: string,
  to: string,
  forward: Map<string, Set<string>>,
  maxPaths: number = 100
): string[][] {
  const paths: string[][] = [];
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (paths.length >= maxPaths) {
      return;
    }

    visited.add(node);
    path.push(node);

    if (node === to) {
      paths.push([...path]);
    } else {
      const neighbors = forward.get(node) ?? new Set<string>();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
    }

    path.pop();
    visited.delete(node);
  }

  dfs(from);
  return paths;
}

/**
 * Get transitive closure from a starting node using BFS.
 *
 * Returns all nodes reachable from the start node.
 *
 * @param start - Starting node ID
 * @param adjacency - Adjacency list (can be forward or reverse)
 * @returns Set of all reachable node IDs (excluding start)
 */
export function getTransitiveClosure(
  start: string,
  adjacency: Map<string, Set<string>>
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [start];
  const visited = new Set<string>();
  visited.add(start);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const neighbors = adjacency.get(node) ?? new Set<string>();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return reachable;
}
