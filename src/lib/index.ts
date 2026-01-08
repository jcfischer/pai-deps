// Re-export manifest types and functions
export {
  // Schemas
  ToolTypeSchema,
  DependencyTypeSchema,
  CliProvidesSchema,
  McpToolProvidesSchema,
  McpResourceProvidesSchema,
  McpProvidesSchema,
  LibraryProvidesSchema,
  DatabaseProvidesSchema,
  ProvidesSectionSchema,
  DependsOnEntrySchema,
  ManifestSchema,
  // Functions
  parseManifest,
  validateManifest,
  // Error class
  ManifestParseError,
  // Types
  type ToolType,
  type DependencyType,
  type CliProvides,
  type McpToolProvides,
  type McpResourceProvides,
  type McpProvides,
  type LibraryProvides,
  type DatabaseProvides,
  type ProvidesSection,
  type DependsOnEntry,
  type Manifest,
  type ValidateResult,
} from './manifest.js';

// Re-export output utilities
export {
  setGlobalOptions,
  getGlobalOptions,
  output,
  log,
  debug,
  warn,
  error,
  success,
  failure,
} from './output.js';

// Re-export dependency graph
export { DependencyGraph } from './graph/index.js';
export type { ToolNode, DependencyEdge, GraphJSON } from './graph/types.js';
