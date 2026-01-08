/**
 * Tool registration logic for pai-deps
 *
 * Handles registering tools from pai-manifest.yaml files into the database,
 * including stub creation for missing dependencies and cycle detection.
 */

import { eq } from 'drizzle-orm';
import { dirname } from 'node:path';
import { getDb } from '../db';
import { tools, dependencies, circularDeps } from '../db/schema';
import {
  parseManifest,
  resolveManifestPath,
  type DependencyType,
  type ProvidesSection,
} from './manifest';
import { detectCycles } from './graph';
import type { GlobalOptions } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Provides count for human-readable output
 */
interface ProvidesCounts {
  cli?: number;
  mcp?: number;
  library?: number;
  database?: number;
}

/**
 * Result of a tool registration
 */
export interface RegisterResult {
  success: boolean;
  action: 'registered' | 'updated';
  tool: {
    id: string;
    name: string;
    version?: string | undefined;
    type: string;
    path: string;
    dependencies: number;
    provides: ProvidesCounts;
  };
  warnings: string[];
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map dependency type to tool type for stub creation
 */
function mapDepTypeToToolType(depType: DependencyType): string {
  switch (depType) {
    case 'cli':
      return 'cli';
    case 'mcp':
      return 'mcp';
    case 'library':
    case 'npm':
      return 'library';
    case 'database':
      return 'library'; // Database providers are typically libraries
    case 'implicit':
      return 'library';
    default:
      return 'library';
  }
}

/**
 * Count provides entries by type
 */
function countProvides(provides?: ProvidesSection): ProvidesCounts {
  if (!provides) return {};

  const counts: ProvidesCounts = {};

  if (provides.cli && provides.cli.length > 0) {
    counts.cli = provides.cli.length;
  }
  if (provides.mcp && provides.mcp.length > 0) {
    counts.mcp = provides.mcp.length;
  }
  if (provides.library && provides.library.length > 0) {
    counts.library = provides.library.length;
  }
  if (provides.database && provides.database.length > 0) {
    counts.database = provides.database.length;
  }

  return counts;
}

// ============================================================================
// Main Registration Function
// ============================================================================

/**
 * Register a tool from its pai-manifest.yaml file
 *
 * @param inputPath - Path to directory containing pai-manifest.yaml or path to manifest file
 * @param _opts - Global CLI options (unused but kept for interface consistency)
 * @returns Registration result with success status, tool info, and warnings
 */
export function registerTool(
  inputPath: string,
  _opts?: GlobalOptions
): RegisterResult {
  const warnings: string[] = [];

  // 1. Resolve manifest path
  const manifestPath = resolveManifestPath(inputPath);

  // 2. Parse manifest
  const manifest = parseManifest(manifestPath);

  // 3. Get database connection
  const db = getDb();

  // 4. Check if tool already exists
  const existing = db
    .select()
    .from(tools)
    .where(eq(tools.id, manifest.name))
    .all();
  const isUpdate = existing.length > 0;

  // 5. Use transaction for atomic operations
  db.transaction((tx) => {
    const now = new Date().toISOString();
    const toolPath = dirname(manifestPath);

    // 5a. Upsert tool
    const toolData = {
      id: manifest.name,
      name: manifest.name,
      path: toolPath,
      type: manifest.type,
      version: manifest.version ?? null,
      reliability: manifest.reliability,
      debtScore: manifest.debt_score,
      manifestPath,
      stub: 0,
      lastVerified: null,
      updatedAt: now,
    };

    if (isUpdate) {
      tx.update(tools).set(toolData).where(eq(tools.id, manifest.name)).run();
      // Delete existing dependencies for this consumer
      tx.delete(dependencies)
        .where(eq(dependencies.consumerId, manifest.name))
        .run();
    } else {
      tx.insert(tools)
        .values({
          ...toolData,
          createdAt: now,
        })
        .run();
    }

    // 5b. Process dependencies
    for (const dep of manifest.depends_on ?? []) {
      // Check if provider exists
      const provider = tx
        .select()
        .from(tools)
        .where(eq(tools.id, dep.name))
        .all();

      if (provider.length === 0) {
        // Create stub
        tx.insert(tools)
          .values({
            id: dep.name,
            name: dep.name,
            path: 'unknown',
            type: mapDepTypeToToolType(dep.type),
            stub: 1,
            reliability: 0.95,
            debtScore: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        warnings.push(`Created stub for unregistered dependency: ${dep.name}`);
      }

      // Create dependency edge
      tx.insert(dependencies)
        .values({
          consumerId: manifest.name,
          providerId: dep.name,
          type: dep.type,
          versionConstraint: dep.version ?? null,
          optional: dep.optional ? 1 : 0,
          createdAt: now,
        })
        .run();
    }
  });

  // 6. Detect cycles (outside transaction)
  const cycles = detectCycles(db, manifest.name);
  for (const cycle of cycles) {
    db.insert(circularDeps)
      .values({
        cycle: JSON.stringify(cycle),
        detectedAt: new Date().toISOString(),
        resolved: 0,
      })
      .run();
    warnings.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
  }

  // 7. Build result
  return {
    success: true,
    action: isUpdate ? 'updated' : 'registered',
    tool: {
      id: manifest.name,
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      path: dirname(manifestPath),
      dependencies: (manifest.depends_on ?? []).length,
      provides: countProvides(manifest.provides),
    },
    warnings,
  };
}
