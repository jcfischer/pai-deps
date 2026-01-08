/**
 * Shared database query functions for pai-deps
 *
 * Provides reusable queries for tools and dependencies.
 */

import { eq, count } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type * as schema from '../db/schema';
import { tools, dependencies } from '../db/schema';
import type { ToolRecord, DependencyRecord } from '../db/schema';

/** Database type alias */
type DbType = BunSQLiteDatabase<typeof schema>;

/**
 * Get a tool by its ID
 *
 * @param db - Database instance
 * @param toolId - Tool ID to look up
 * @returns Tool record or null if not found
 */
export function getToolById(db: DbType, toolId: string): ToolRecord | null {
  const result = db.select().from(tools).where(eq(tools.id, toolId)).all();
  return result[0] ?? null;
}

/**
 * Get all dependencies for a tool (tools this one depends on)
 *
 * @param db - Database instance
 * @param toolId - Consumer tool ID
 * @returns Array of dependency records
 */
export function getToolDependencies(
  db: DbType,
  toolId: string
): DependencyRecord[] {
  return db
    .select()
    .from(dependencies)
    .where(eq(dependencies.consumerId, toolId))
    .all();
}

/**
 * Get all dependents (tools that depend on this one)
 *
 * @param db - Database instance
 * @param toolId - Provider tool ID
 * @returns Array of dependency records where this tool is the provider
 */
export function getToolDependents(
  db: DbType,
  toolId: string
): DependencyRecord[] {
  return db
    .select()
    .from(dependencies)
    .where(eq(dependencies.providerId, toolId))
    .all();
}

/**
 * Count dependencies for a tool
 *
 * @param db - Database instance
 * @param toolId - Tool ID to count dependencies for
 * @returns Number of dependencies
 */
export function countDependencies(db: DbType, toolId: string): number {
  const result = db
    .select({ count: count() })
    .from(dependencies)
    .where(eq(dependencies.consumerId, toolId))
    .all();
  return result[0]?.count ?? 0;
}
