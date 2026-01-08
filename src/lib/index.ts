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

// Re-export DOT generation
export { generateDot, type DotOptions } from './dot.js';

// Re-export schema hasher
export {
  normalizeJson,
  hashJson,
  hashSchemaFile,
  compareHashes,
  detectFieldChanges,
  type HashResult,
  type DriftResult,
} from './hasher.js';

// Re-export schema validator
export {
  validateAgainstSchema,
  loadSchemaFile,
  loadContractSchema,
  formatValidationErrors,
  type ValidationError,
  type ValidationResult,
  type SchemaLoadResult,
} from './validator.js';
