/**
 * Graph utilities for dependency analysis
 *
 * Provides cycle detection using depth-first search on the dependency graph.
 */

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { dependencies } from '../db/schema';

type DbType = BunSQLiteDatabase<typeof schema>;

/**
 * Detect circular dependencies starting from a specific tool.
 *
 * Uses DFS with a recursion stack to find back edges indicating cycles.
 * Returns all cycles found starting from or passing through the given tool.
 *
 * @param db - Drizzle database instance
 * @param startToolId - The tool ID to start detection from
 * @returns Array of cycles, each cycle is an array of tool IDs forming the cycle
 */
export function detectCycles(db: DbType, startToolId: string): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(toolId: string): void {
    visited.add(toolId);
    recursionStack.add(toolId);
    path.push(toolId);

    // Get all dependencies of this tool (where this tool is the consumer)
    const deps = db
      .select()
      .from(dependencies)
      .where(eq(dependencies.consumerId, toolId))
      .all();

    for (const dep of deps) {
      if (!visited.has(dep.providerId)) {
        dfs(dep.providerId);
      } else if (recursionStack.has(dep.providerId)) {
        // Found cycle - extract the cycle path
        const cycleStart = path.indexOf(dep.providerId);
        const cycle = [...path.slice(cycleStart), dep.providerId];
        cycles.push(cycle);
      }
    }

    path.pop();
    recursionStack.delete(toolId);
  }

  dfs(startToolId);
  return cycles;
}
