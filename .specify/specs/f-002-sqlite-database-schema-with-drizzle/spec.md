# Feature Specification: F-002 - SQLite Database Schema with Drizzle

**Feature ID:** F-002
**Phase:** 1 (Core Registry)
**Priority:** 2
**Estimated Hours:** 3
**Reliability Target:** 0.95
**Dependencies:** F-001 (CLI foundation)

---

## Summary

Define the database schema using Drizzle ORM for storing tools, dependencies, contracts, verifications, and circular dependencies. Create the database at `~/.config/pai-deps/pai-deps.db` with automatic migration on first run.

---

## User Scenarios

### Scenario 1: First Run - Database Creation
**Given** pai-deps has never been run before
**When** any command is executed
**Then** the database is created at `~/.config/pai-deps/pai-deps.db`
**And** all tables are created with correct schema
**And** no error is shown to the user

### Scenario 2: Database Already Exists
**Given** the database already exists
**When** any command is executed
**Then** the existing database is used
**And** migrations are applied if schema has changed
**And** existing data is preserved

### Scenario 3: Config Directory Missing
**Given** `~/.config/pai-deps/` directory does not exist
**When** any command is executed
**Then** the directory is created automatically
**And** the database is created inside it

---

## Functional Requirements

### FR-1: Database Location
- Database MUST be stored at `~/.config/pai-deps/pai-deps.db`
- Directory MUST be created automatically if it doesn't exist
- Database MUST be SQLite format

### FR-2: Tools Table
The `tools` table MUST store:
- `id` (TEXT, PRIMARY KEY) - unique identifier, e.g., "email"
- `name` (TEXT, NOT NULL) - display name
- `path` (TEXT, NOT NULL) - filesystem path to tool
- `type` (TEXT, NOT NULL) - one of: cli, mcp, library, workflow, hook
- `version` (TEXT, nullable) - semantic version
- `reliability` (REAL, default 0.95) - reliability score 0.0-1.0
- `debt_score` (INTEGER, default 0) - technical debt score
- `manifest_path` (TEXT, nullable) - path to pai-manifest.yaml
- `stub` (INTEGER, default 0) - 1 if auto-created stub entry
- `last_verified` (TEXT, nullable) - ISO timestamp of last verification
- `created_at` (TEXT, NOT NULL) - ISO timestamp
- `updated_at` (TEXT, NOT NULL) - ISO timestamp

### FR-3: Dependencies Table
The `dependencies` table MUST store:
- `id` (INTEGER, PRIMARY KEY, autoincrement)
- `consumer_id` (TEXT, NOT NULL, FK → tools.id) - tool that depends
- `provider_id` (TEXT, NOT NULL, FK → tools.id) - tool being depended on
- `type` (TEXT, NOT NULL) - one of: cli, mcp, library, database, implicit
- `version_constraint` (TEXT, nullable) - semver constraint
- `optional` (INTEGER, default 0) - 1 if optional dependency
- `created_at` (TEXT, NOT NULL) - ISO timestamp

### FR-4: Contracts Table
The `contracts` table MUST store:
- `id` (INTEGER, PRIMARY KEY, autoincrement)
- `tool_id` (TEXT, NOT NULL, FK → tools.id)
- `contract_type` (TEXT, NOT NULL) - one of: cli_output, mcp_tool, library_export, db_schema
- `name` (TEXT, NOT NULL) - e.g., "email search --json"
- `schema_path` (TEXT, nullable) - path to JSON schema file
- `schema_hash` (TEXT, nullable) - SHA256 hash for drift detection
- `last_verified` (TEXT, nullable) - ISO timestamp
- `status` (TEXT, default 'unknown') - one of: valid, drift, broken, unknown

### FR-5: Verifications Table
The `verifications` table MUST store:
- `id` (INTEGER, PRIMARY KEY, autoincrement)
- `contract_id` (INTEGER, NOT NULL, FK → contracts.id)
- `verified_at` (TEXT, NOT NULL) - ISO timestamp
- `status` (TEXT, NOT NULL) - one of: pass, fail, drift
- `details` (TEXT, nullable) - JSON with error details or diff
- `git_commit` (TEXT, nullable) - git commit hash at verification time

### FR-6: Circular Dependencies Table
The `circular_deps` table MUST store:
- `id` (INTEGER, PRIMARY KEY, autoincrement)
- `cycle` (TEXT, NOT NULL) - JSON array of tool IDs in cycle
- `detected_at` (TEXT, NOT NULL) - ISO timestamp
- `resolved` (INTEGER, default 0) - 1 if manually marked resolved

### FR-7: Database Indexes
The following indexes MUST be created for performance:
- `idx_tools_type` on tools(type)
- `idx_tools_stub` on tools(stub)
- `idx_deps_consumer` on dependencies(consumer_id)
- `idx_deps_provider` on dependencies(provider_id)
- `idx_contracts_tool` on contracts(tool_id)
- `idx_verifications_contract` on verifications(contract_id)

### FR-8: Foreign Key Constraints
- `dependencies.consumer_id` MUST reference `tools.id`
- `dependencies.provider_id` MUST reference `tools.id`
- `contracts.tool_id` MUST reference `tools.id`
- `verifications.contract_id` MUST reference `contracts.id`
- ON DELETE CASCADE for all foreign keys

### FR-9: Database Connection
- Provide `getDb()` function that returns initialized database
- Connection MUST be lazy-initialized (created on first use)
- Connection MUST be reusable across commands

---

## Non-Functional Requirements

### NFR-1: Performance
- Database initialization MUST complete in < 100ms
- Simple queries MUST complete in < 10ms

### NFR-2: Reliability
- Database operations MUST be atomic (use transactions where needed)
- Foreign key constraints MUST be enforced

### NFR-3: Maintainability
- Schema MUST be defined using Drizzle ORM
- Migrations MUST be handled automatically by Drizzle

---

## Acceptance Criteria

- [ ] Database created at `~/.config/pai-deps/pai-deps.db` on first run
- [ ] All 5 tables exist with correct columns and types
- [ ] All indexes created for performance
- [ ] Foreign key constraints enforced (test with invalid insert)
- [ ] Drizzle migrations run automatically on startup
- [ ] `getDb()` function exported and working
- [ ] Type-safe queries work with Drizzle

---

## Out of Scope

- Data seeding (handled by F-004 register command)
- Complex queries (handled by later features)
- Database backup/restore
- Multiple database files

---

## References

- App Context: `/Users/fischer/work/pai-deps/.specify/app-context.md` (Data Model section)
- Drizzle ORM: https://orm.drizzle.team/
