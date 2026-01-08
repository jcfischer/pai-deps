/**
 * Drizzle ORM Schema for pai-deps database
 *
 * Tables:
 * - tools: Registry of all PAI tools
 * - dependencies: Relationships between tools
 * - contracts: Interface contracts for tools
 * - verifications: Verification history for contracts
 * - circularDeps: Detected circular dependency cycles
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

/**
 * Tools table - stores all registered PAI tools
 */
export const tools = sqliteTable('tools', {
  /** Unique identifier (e.g., "email", "tana-mcp") */
  id: text('id').primaryKey(),
  /** Human-readable display name */
  name: text('name').notNull(),
  /** Filesystem path to the tool */
  path: text('path').notNull(),
  /** Tool type: cli | mcp | library | workflow | hook */
  type: text('type').notNull(),
  /** Semantic version (nullable) */
  version: text('version'),
  /** Reliability score 0.0-1.0 */
  reliability: real('reliability').default(0.95),
  /** Technical debt score */
  debtScore: integer('debt_score').default(0),
  /** Path to pai-manifest.yaml */
  manifestPath: text('manifest_path'),
  /** 1 if this is an auto-created stub entry */
  stub: integer('stub').default(0),
  /** ISO timestamp of last verification */
  lastVerified: text('last_verified'),
  /** ISO timestamp of creation */
  createdAt: text('created_at').notNull(),
  /** ISO timestamp of last update */
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  typeIdx: index('idx_tools_type').on(table.type),
  stubIdx: index('idx_tools_stub').on(table.stub),
}));

/**
 * Dependencies table - relationships between tools
 */
export const dependencies = sqliteTable('dependencies', {
  /** Auto-incrementing primary key */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** ID of the tool that has the dependency (FK to tools.id) */
  consumerId: text('consumer_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  /** ID of the tool being depended on (FK to tools.id) */
  providerId: text('provider_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  /** Dependency type: cli | mcp | library | database | implicit */
  type: text('type').notNull(),
  /** Semver constraint (nullable) */
  versionConstraint: text('version_constraint'),
  /** 1 if this is an optional dependency */
  optional: integer('optional').default(0),
  /** ISO timestamp of creation */
  createdAt: text('created_at').notNull(),
}, (table) => ({
  consumerIdx: index('idx_deps_consumer').on(table.consumerId),
  providerIdx: index('idx_deps_provider').on(table.providerId),
}));

/**
 * Contracts table - interface contracts for tools
 */
export const contracts = sqliteTable('contracts', {
  /** Auto-incrementing primary key */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** ID of the tool this contract belongs to (FK to tools.id) */
  toolId: text('tool_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  /** Contract type: cli_output | mcp_tool | library_export | db_schema */
  contractType: text('contract_type').notNull(),
  /** Contract name (e.g., "email search --json") */
  name: text('name').notNull(),
  /** Path to JSON schema file (nullable) */
  schemaPath: text('schema_path'),
  /** SHA256 hash for drift detection (nullable) */
  schemaHash: text('schema_hash'),
  /** ISO timestamp of last verification (nullable) */
  lastVerified: text('last_verified'),
  /** Contract status: valid | drift | broken | unknown */
  status: text('status').default('unknown'),
}, (table) => ({
  toolIdx: index('idx_contracts_tool').on(table.toolId),
}));

/**
 * Verifications table - verification history for contracts
 */
export const verifications = sqliteTable('verifications', {
  /** Auto-incrementing primary key */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** ID of the contract being verified (FK to contracts.id) */
  contractId: integer('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  /** ISO timestamp of verification */
  verifiedAt: text('verified_at').notNull(),
  /** Verification status: pass | fail | drift */
  status: text('status').notNull(),
  /** JSON with error details or diff (nullable) */
  details: text('details'),
  /** Git commit hash at verification time (nullable) */
  gitCommit: text('git_commit'),
}, (table) => ({
  contractIdx: index('idx_verifications_contract').on(table.contractId),
}));

/**
 * Tool verifications table - verification history for tools
 */
export const toolVerifications = sqliteTable('tool_verifications', {
  /** Auto-incrementing primary key */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** ID of the tool being verified (FK to tools.id) */
  toolId: text('tool_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  /** ISO timestamp of verification */
  verifiedAt: text('verified_at').notNull(),
  /** CLI verification status: pass | fail | skipped */
  cliStatus: text('cli_status'),
  /** Number of CLI commands passed */
  cliPassed: integer('cli_passed'),
  /** Number of CLI commands failed */
  cliFailed: integer('cli_failed'),
  /** Number of CLI commands skipped */
  cliSkipped: integer('cli_skipped'),
  /** MCP verification status: pass | fail | skipped */
  mcpStatus: text('mcp_status'),
  /** Number of MCP tools found */
  mcpFound: integer('mcp_found'),
  /** Number of MCP tools missing */
  mcpMissing: integer('mcp_missing'),
  /** Number of extra MCP tools */
  mcpExtra: integer('mcp_extra'),
  /** Overall status: pass | fail */
  overallStatus: text('overall_status').notNull(),
  /** Git commit hash at verification time (nullable) */
  gitCommit: text('git_commit'),
  /** Duration of verification in milliseconds */
  durationMs: integer('duration_ms'),
}, (table) => ({
  toolIdx: index('idx_tool_verifications_tool').on(table.toolId),
  verifiedIdx: index('idx_tool_verifications_verified').on(table.verifiedAt),
}));

/**
 * Circular dependencies table - detected cycles
 */
export const circularDeps = sqliteTable('circular_deps', {
  /** Auto-incrementing primary key */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** JSON array of tool IDs in the cycle */
  cycle: text('cycle').notNull(),
  /** ISO timestamp when cycle was detected */
  detectedAt: text('detected_at').notNull(),
  /** 1 if manually marked as resolved */
  resolved: integer('resolved').default(0),
});

// Export inferred types for type-safe queries
export type ToolRecord = typeof tools.$inferSelect;
export type NewToolRecord = typeof tools.$inferInsert;
export type DependencyRecord = typeof dependencies.$inferSelect;
export type NewDependencyRecord = typeof dependencies.$inferInsert;
export type ContractRecord = typeof contracts.$inferSelect;
export type NewContractRecord = typeof contracts.$inferInsert;
export type VerificationRecord = typeof verifications.$inferSelect;
export type NewVerificationRecord = typeof verifications.$inferInsert;
export type CircularDepRecord = typeof circularDeps.$inferSelect;
export type NewCircularDepRecord = typeof circularDeps.$inferInsert;
export type ToolVerificationRecord = typeof toolVerifications.$inferSelect;
export type NewToolVerificationRecord = typeof toolVerifications.$inferInsert;
