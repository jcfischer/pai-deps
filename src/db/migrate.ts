/**
 * Database migration runner for pai-deps
 *
 * Uses raw SQL CREATE TABLE IF NOT EXISTS statements for idempotent migrations.
 * This approach is simpler than using drizzle-kit migrations for a single-user CLI tool.
 */

import type { Database } from 'bun:sqlite';

/**
 * SQL statements to create all tables.
 * All statements are idempotent (safe to run multiple times).
 */
const CREATE_TABLES_SQL = `
-- Tools table: registry of all PAI tools
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  version TEXT,
  reliability REAL DEFAULT 0.95,
  debt_score INTEGER DEFAULT 0,
  manifest_path TEXT,
  stub INTEGER DEFAULT 0,
  last_verified TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Dependencies table: relationships between tools
CREATE TABLE IF NOT EXISTS dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumer_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  version_constraint TEXT,
  optional INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Contracts table: interface contracts for tools
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL,
  name TEXT NOT NULL,
  schema_path TEXT,
  schema_hash TEXT,
  last_verified TEXT,
  status TEXT DEFAULT 'unknown'
);

-- Verifications table: verification history for contracts
CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  verified_at TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  git_commit TEXT
);

-- Circular dependencies table: detected cycles
CREATE TABLE IF NOT EXISTS circular_deps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved INTEGER DEFAULT 0
);
`;

/**
 * SQL statements to create all indexes.
 * All statements are idempotent.
 */
const CREATE_INDEXES_SQL = `
-- Tools indexes
CREATE INDEX IF NOT EXISTS idx_tools_type ON tools(type);
CREATE INDEX IF NOT EXISTS idx_tools_stub ON tools(stub);

-- Dependencies indexes
CREATE INDEX IF NOT EXISTS idx_deps_consumer ON dependencies(consumer_id);
CREATE INDEX IF NOT EXISTS idx_deps_provider ON dependencies(provider_id);

-- Contracts indexes
CREATE INDEX IF NOT EXISTS idx_contracts_tool ON contracts(tool_id);

-- Verifications indexes
CREATE INDEX IF NOT EXISTS idx_verifications_contract ON verifications(contract_id);
`;

/**
 * Run database migrations.
 *
 * Creates all tables and indexes if they don't exist.
 * Safe to call multiple times (idempotent).
 *
 * @param sqlite - The bun:sqlite Database instance
 */
export function runMigrations(sqlite: Database): void {
  // Enable foreign keys before creating tables
  sqlite.run('PRAGMA foreign_keys = ON');

  // Create tables
  sqlite.run(CREATE_TABLES_SQL);

  // Create indexes
  sqlite.run(CREATE_INDEXES_SQL);
}
