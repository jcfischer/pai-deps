import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * Tool types - what kind of tool this manifest describes
 */
export const ToolTypeSchema = z.enum([
  'cli',
  'mcp',
  'library',
  'workflow',
  'hook',
  'cli+mcp',
]);

/**
 * Dependency types - what kind of dependency is being declared
 */
export const DependencyTypeSchema = z.enum([
  'cli',
  'mcp',
  'library',
  'database',
  'npm',
  'implicit',
]);

// ============================================================================
// Provides Sub-Schemas
// ============================================================================

/**
 * CLI command provided by the tool
 */
export const CliProvidesSchema = z.object({
  command: z.string().min(1, 'command is required'),
  output_schema: z.string().optional(),
});

/**
 * MCP tool provided by the tool
 */
export const McpToolProvidesSchema = z.object({
  tool: z.string().min(1, 'tool name is required'),
  schema: z.string().optional(),
});

/**
 * MCP resource provided by the tool
 */
export const McpResourceProvidesSchema = z.object({
  resource: z.string().min(1, 'resource is required'),
  schema: z.string().optional(),
});

/**
 * MCP provides - can be either a tool or a resource
 */
export const McpProvidesSchema = z.union([
  McpToolProvidesSchema,
  McpResourceProvidesSchema,
]);

/**
 * Library export provided by the tool
 */
export const LibraryProvidesSchema = z.object({
  export: z.string().min(1, 'export name is required'),
  path: z.string().optional(),
});

/**
 * Database provided by the tool
 */
export const DatabaseProvidesSchema = z.object({
  path: z.string().min(1, 'database path is required'),
  schema: z.string().optional(),
});

/**
 * Provides section - what the tool provides to other tools
 */
export const ProvidesSectionSchema = z
  .object({
    cli: z.array(CliProvidesSchema).optional(),
    mcp: z.array(McpProvidesSchema).optional(),
    library: z.array(LibraryProvidesSchema).optional(),
    database: z.array(DatabaseProvidesSchema).optional(),
  })
  .optional();

// ============================================================================
// Depends On Schema
// ============================================================================

/**
 * A single dependency entry
 */
export const DependsOnEntrySchema = z.object({
  name: z.string().min(1, 'dependency name is required'),
  type: DependencyTypeSchema,
  version: z.string().optional(),
  import: z.string().optional(),
  commands: z.array(z.string()).optional(),
  optional: z.boolean().default(false),
});

// ============================================================================
// Main Manifest Schema
// ============================================================================

/**
 * Full manifest schema for pai-manifest.yaml
 */
export const ManifestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  version: z.string().optional(),
  type: ToolTypeSchema,
  description: z.string().optional(),
  provides: ProvidesSectionSchema,
  depends_on: z.array(DependsOnEntrySchema).optional().default([]),
  reliability: z.number().min(0).max(1).default(0.95),
  debt_score: z.number().int().min(0).default(0),
  /** Command to start MCP server for verification (e.g., "bun run src/index.ts") */
  mcp_start: z.string().optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type ToolType = z.infer<typeof ToolTypeSchema>;
export type DependencyType = z.infer<typeof DependencyTypeSchema>;
export type CliProvides = z.infer<typeof CliProvidesSchema>;
export type McpToolProvides = z.infer<typeof McpToolProvidesSchema>;
export type McpResourceProvides = z.infer<typeof McpResourceProvidesSchema>;
export type McpProvides = z.infer<typeof McpProvidesSchema>;
export type LibraryProvides = z.infer<typeof LibraryProvidesSchema>;
export type DatabaseProvides = z.infer<typeof DatabaseProvidesSchema>;
export type ProvidesSection = z.infer<typeof ProvidesSectionSchema>;
export type DependsOnEntry = z.infer<typeof DependsOnEntrySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse error with formatted message
 */
export class ManifestParseError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly issues?: z.ZodIssue[]
  ) {
    super(message);
    this.name = 'ManifestParseError';
  }
}

/**
 * Format Zod issues into human-readable error messages
 */
function formatZodIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `  ${path}: ${issue.message}`;
    })
    .join('\n');
}

/**
 * Parse a manifest from a YAML file
 * @param filePath - Path to the pai-manifest.yaml file
 * @returns Parsed and validated Manifest object
 * @throws ManifestParseError if file cannot be read or validation fails
 */
export function parseManifest(filePath: string): Manifest {
  let content: string;

  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ManifestParseError(
      `Failed to read manifest file: ${message}`,
      filePath
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ManifestParseError(
      `Invalid YAML syntax: ${message}`,
      filePath
    );
  }

  const result = ManifestSchema.safeParse(parsed);

  if (!result.success) {
    const formattedErrors = formatZodIssues(result.error.issues);
    throw new ManifestParseError(
      `Invalid manifest at ${filePath}:\n${formattedErrors}`,
      filePath,
      result.error.issues
    );
  }

  return result.data;
}

/**
 * Validation result type for validateManifest
 */
export type ValidateResult =
  | { success: true; data: Manifest }
  | { success: false; error: z.ZodError };

/**
 * Validate a manifest object without filesystem access
 * @param content - Raw object to validate
 * @returns Validation result with either data or error
 */
export function validateManifest(content: unknown): ValidateResult {
  const result = ManifestSchema.safeParse(content);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error };
}

// ============================================================================
// Path Resolution
// ============================================================================

/** Default manifest filename */
const MANIFEST_FILENAME = 'pai-manifest.yaml';

/**
 * Resolve input path to absolute path of pai-manifest.yaml
 *
 * @param inputPath - Path to directory or manifest file
 * @returns Absolute path to the manifest file
 * @throws ManifestParseError if file not found
 */
export function resolveManifestPath(inputPath: string): string {
  // Resolve to absolute path
  const absolutePath = resolve(inputPath);

  // Check if path exists
  if (!existsSync(absolutePath)) {
    throw new ManifestParseError(
      `Path not found: ${absolutePath}`,
      absolutePath
    );
  }

  const stats = statSync(absolutePath);

  // If it's a directory, append pai-manifest.yaml
  if (stats.isDirectory()) {
    const manifestPath = join(absolutePath, MANIFEST_FILENAME);
    if (!existsSync(manifestPath)) {
      throw new ManifestParseError(
        `Manifest not found: ${manifestPath}`,
        manifestPath
      );
    }
    return manifestPath;
  }

  // It's a file - use directly
  return absolutePath;
}
