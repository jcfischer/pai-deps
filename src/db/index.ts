/**
 * Database connection and initialization for pai-deps
 *
 * Provides a lazy-initialized singleton database connection.
 * Database is stored at ~/.config/pai-deps/pai-deps.db by default.
 * Use PAI_DEPS_DB environment variable to override for testing.
 */

import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as schema from './schema';
import { runMigrations } from './migrate';

/** Default database directory */
export const DB_DIR = join(homedir(), '.config', 'pai-deps');

/** Default database path */
export const DB_PATH = join(DB_DIR, 'pai-deps.db');

/**
 * Get the database path.
 * Returns PAI_DEPS_DB env var if set, otherwise the default path.
 */
export function getDbPath(): string {
  return process.env['PAI_DEPS_DB'] ?? DB_PATH;
}

/** Singleton database instance */
let db: BunSQLiteDatabase<typeof schema> | null = null;

/** Singleton SQLite instance (for closing) */
let sqlite: Database | null = null;

/**
 * Get the database instance.
 *
 * Creates the database and tables on first access.
 * Returns the cached instance on subsequent calls.
 *
 * @returns The Drizzle database instance
 */
export function getDb(): BunSQLiteDatabase<typeof schema> {
  if (db) return db;

  const dbPath = getDbPath();
  const dbDir = dirname(dbPath);

  // Create directory if it doesn't exist
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Create SQLite connection
  sqlite = new Database(dbPath);

  // Enable foreign keys
  sqlite.run('PRAGMA foreign_keys = ON');

  // Run migrations to create tables
  runMigrations(sqlite);

  // Create Drizzle instance
  db = drizzle(sqlite, { schema });

  return db;
}

/**
 * Close the database connection.
 *
 * Useful for cleanup in tests.
 */
export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

/**
 * Reset the database singleton.
 *
 * Forces a new connection on next getDb() call.
 * Useful for tests that need a fresh database instance.
 */
export function resetDb(): void {
  closeDb();
}

// Re-export schema for convenience
export * from './schema';
