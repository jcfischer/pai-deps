# Feature Specification: F-004 - Register Command with Stub Creation

**Feature ID:** F-004
**Phase:** 1 (Core Registry)
**Priority:** 3
**Estimated Hours:** 4
**Reliability Target:** 0.92
**Dependencies:** F-002 (Database), F-003 (Manifest parser)

---

## Summary

Implement the `pai-deps register <path>` command to parse a `pai-manifest.yaml` file, store the tool in the database, and create dependency edges. When a dependency references a tool that isn't registered, automatically create a stub entry with a warning. Detect and record circular dependencies.

---

## User Scenarios

### Scenario 1: Register New Tool
**Given** a valid pai-manifest.yaml at /path/to/tool/
**When** running `pai-deps register /path/to/tool`
**Then** the tool is stored in the database
**And** all dependencies are linked as edges
**And** success message shows the tool name and dependency count

### Scenario 2: Register with Missing Dependencies
**Given** a manifest that depends on "resona" which isn't registered
**When** running `pai-deps register /path/to/tool`
**Then** a stub entry for "resona" is created in the database
**And** the dependency edge is created pointing to the stub
**And** a warning is shown: "Created stub for unregistered dependency: resona"

### Scenario 3: Update Existing Registration
**Given** a tool "email" is already registered
**When** running `pai-deps register /path/to/email` again
**Then** the existing entry is updated (not duplicated)
**And** dependencies are reconciled (added/removed as needed)
**And** message shows "Updated email" instead of "Registered email"

### Scenario 4: Circular Dependency Detection
**Given** tool A depends on B, and B depends on A
**When** registering tool A (after B is registered)
**Then** the circular dependency is detected
**And** an entry is added to circular_deps table
**And** a warning is shown: "Circular dependency detected: A -> B -> A"
**And** registration still succeeds (warning, not error)

### Scenario 5: JSON Output
**Given** any registration scenario
**When** running with `--json` flag
**Then** output is `{ success: true, tool: {...}, warnings: [...] }`
**And** exit code is 0

---

## Functional Requirements

### FR-1: Command Syntax
```
pai-deps register <path> [options]

Arguments:
  path           Path to directory containing pai-manifest.yaml
                 OR path directly to the manifest file

Options:
  --json         Output result as JSON
  --quiet        Suppress warnings
  --verbose      Show debug information
```

### FR-2: Manifest Discovery
- If `<path>` is a directory, look for `pai-manifest.yaml` in it
- If `<path>` is a file, use it directly
- Fail with clear error if manifest not found

### FR-3: Tool Storage
Store in `tools` table:
- `id`: From manifest name
- `name`: From manifest name
- `path`: Absolute path to manifest directory
- `type`: From manifest type
- `version`: From manifest version (nullable)
- `reliability`: From manifest (default 0.95)
- `debt_score`: From manifest (default 0)
- `manifest_path`: Absolute path to pai-manifest.yaml
- `stub`: 0 (false)
- `last_verified`: null
- `created_at`: Current ISO timestamp
- `updated_at`: Current ISO timestamp

### FR-4: Dependency Edge Creation
For each entry in `depends_on`:
1. Check if provider tool exists in database
2. If not exists, create stub entry (FR-5)
3. Create edge in `dependencies` table:
   - `consumer_id`: Current tool's id
   - `provider_id`: Dependency's name (id)
   - `type`: From depends_on entry
   - `version_constraint`: From depends_on version
   - `optional`: From depends_on optional flag
   - `created_at`: Current timestamp

### FR-5: Stub Entry Creation
When dependency references unregistered tool:
1. Create entry in `tools` table:
   - `id`: Dependency name
   - `name`: Dependency name
   - `path`: "unknown"
   - `type`: From depends_on type (or "unknown")
   - `stub`: 1 (true)
   - `created_at`: Current timestamp
   - `updated_at`: Current timestamp
2. Emit warning: "Created stub for unregistered dependency: <name>"

### FR-6: Circular Dependency Detection
After creating all edges:
1. Run cycle detection starting from the new tool
2. If cycle found:
   - Store in `circular_deps` table as JSON array
   - Emit warning with cycle path
   - Continue (don't fail)

### FR-7: Update Existing Tool
If tool with same id already exists:
1. Update all fields except `created_at`
2. Delete existing dependency edges for this consumer
3. Recreate dependency edges from current manifest
4. Use "Updated" instead of "Registered" in output

### FR-8: Output Format

**Human-readable:**
```
Registered email v1.2.0
  Dependencies: 3 (1 stub created)
  Provides: 2 CLI commands, 1 MCP tool
```

**JSON:**
```json
{
  "success": true,
  "action": "registered",
  "tool": {
    "id": "email",
    "name": "email",
    "version": "1.2.0",
    "type": "cli+mcp",
    "path": "/Users/fischer/work/DA/KAI/skills/email",
    "dependencies": 3,
    "provides": {
      "cli": 2,
      "mcp": 1
    }
  },
  "warnings": [
    "Created stub for unregistered dependency: resona"
  ]
}
```

---

## Non-Functional Requirements

### NFR-1: Idempotency
Running register twice with same manifest MUST produce same database state.

### NFR-2: Transaction Safety
All database operations for a single registration MUST be atomic.

### NFR-3: Performance
Registration MUST complete in < 500ms for typical manifest.

---

## Acceptance Criteria

- [ ] `pai-deps register /path` registers tool from manifest
- [ ] Missing dependencies create stub entries with warning
- [ ] Circular dependencies detected and stored
- [ ] Duplicate registration updates existing entry
- [ ] `--json` outputs structured result
- [ ] All database operations are transactional
- [ ] Tests cover all scenarios

---

## Out of Scope

- Contract verification (F-013, F-014)
- Batch registration of multiple tools (F-024)
- Manifest auto-generation (F-025)
- Unregister command (F-005)

---

## References

- Spec F-002: Database schema
- Spec F-003: Manifest parser
- App Context: `/Users/fischer/work/pai-deps/.specify/app-context.md`
