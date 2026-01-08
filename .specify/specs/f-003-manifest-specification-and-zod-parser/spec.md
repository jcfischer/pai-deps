# Feature Specification: F-003 - Manifest Specification and Zod Parser

**Feature ID:** F-003
**Phase:** 1 (Core Registry)
**Priority:** 2
**Estimated Hours:** 3
**Reliability Target:** 0.95
**Dependencies:** F-001 (CLI foundation)

---

## Summary

Define the `pai-manifest.yaml` schema using Zod for type-safe parsing and validation. The manifest declares a tool's identity, what it provides (CLI commands, MCP tools, databases), what it depends on, and its reliability/debt metrics. Generate JSON Schema for external validation and IDE support.

---

## User Scenarios

### Scenario 1: Valid Manifest Parsing
**Given** a pai-manifest.yaml with all required fields
**When** the manifest is parsed
**Then** a typed Tool object is returned
**And** optional fields have default values (reliability: 0.95, debt_score: 0)

### Scenario 2: Invalid Manifest - Missing Required Fields
**Given** a pai-manifest.yaml missing the `name` field
**When** the manifest is parsed
**Then** a clear error message indicates "name is required"
**And** the line number is included if possible

### Scenario 3: Invalid Manifest - Wrong Type
**Given** a pai-manifest.yaml with `type: invalid`
**When** the manifest is parsed
**Then** a clear error message indicates valid types: cli, mcp, library, workflow, hook

### Scenario 4: Manifest with Dependencies
**Given** a pai-manifest.yaml with depends_on entries
**When** the manifest is parsed
**Then** each dependency has name, type, and optional version constraint
**And** CLI dependencies can specify which commands are used

---

## Functional Requirements

### FR-1: Manifest Structure
The manifest MUST support the following top-level fields:

```yaml
name: string (required)        # Tool identifier, e.g., "email"
version: string (optional)     # Semver, e.g., "1.2.0"
type: string (required)        # cli | mcp | library | workflow | hook | cli+mcp
description: string (optional) # Human-readable description

provides: object (optional)    # What this tool provides
depends_on: array (optional)   # Dependencies on other tools

reliability: number (optional) # 0.0-1.0, default 0.95
debt_score: integer (optional) # 0+, default 0
```

### FR-2: Provides Section
The `provides` field MUST support:

```yaml
provides:
  cli:                         # CLI commands provided
    - command: "email search"  # Command signature
      output_schema: ./schemas/search.json  # Optional JSON Schema path
    - command: "email stats"
      output_schema: ./schemas/stats.json

  mcp:                         # MCP tools provided
    - tool: "email_search"     # Tool name
      schema: ./schemas/mcp-search.json  # Optional schema
    - resource: "email://inbox"  # MCP resource
      schema: ./schemas/inbox.json

  library:                     # Library exports
    - export: "createClient"   # Export name
      path: ./src/client.ts    # Optional path

  database:                    # Database schemas
    - path: ~/.config/email/email.db
      schema: ./src/db/schema.ts
```

### FR-3: Depends On Section
The `depends_on` field MUST support:

```yaml
depends_on:
  - name: resona               # Required: tool/package name
    type: library              # Required: cli | mcp | library | database | npm | implicit
    version: ">=1.0.0"         # Optional: semver constraint
    import: "@pai/resona"      # Optional: import path for libraries
    commands:                  # Optional: specific CLI commands used
      - "resona embed"
    optional: false            # Optional: default false
```

### FR-4: Parser Function
Provide a `parseManifest(path: string)` function that:
- Reads YAML file from filesystem
- Validates against Zod schema
- Returns typed `Manifest` object or throws descriptive error
- Resolves relative paths for schemas

### FR-5: Validation Function
Provide a `validateManifest(content: unknown)` function that:
- Validates raw object against Zod schema
- Returns `{ success: true, data: Manifest }` or `{ success: false, error: ZodError }`
- Does not require filesystem access

### FR-6: JSON Schema Generation
Generate a JSON Schema at `schemas/manifest.json` that:
- Matches the Zod schema exactly
- Can be used by IDEs for YAML validation
- Can be used by external tools

### FR-7: Type Exports
Export TypeScript types for:
- `Manifest` - Full parsed manifest
- `ProvidesSection` - What the tool provides
- `DependsOnEntry` - Single dependency entry
- `CliProvides`, `McpProvides`, `LibraryProvides`, `DatabaseProvides` - Subsections

---

## Non-Functional Requirements

### NFR-1: Error Messages
- Parse errors MUST include the field path (e.g., "depends_on[0].name")
- Type errors MUST list valid options
- Missing required fields MUST be clearly identified

### NFR-2: Performance
- Parsing a manifest MUST complete in < 50ms

### NFR-3: Compatibility
- MUST support YAML 1.2
- MUST handle missing optional fields with defaults

---

## Acceptance Criteria

- [ ] Zod schema validates all manifest fields from design doc
- [ ] `parseManifest()` returns typed object for valid YAML
- [ ] Invalid manifests produce clear error messages with field paths
- [ ] Optional fields have sensible defaults (reliability: 0.95, debt_score: 0)
- [ ] JSON Schema generated at schemas/manifest.json
- [ ] All TypeScript types exported from src/lib/manifest.ts
- [ ] Unit tests cover valid and invalid manifest scenarios

---

## Out of Scope

- Manifest file discovery (F-024)
- Auto-generation from package.json (F-025)
- Database storage of parsed manifests (F-004)
- Validation of referenced schema files

---

## References

- Design Doc: `/Users/fischer/work/kai-improvement-roadmap/design-pai-dependency-tracker.md` (Appendix A)
- App Context: `/Users/fischer/work/pai-deps/.specify/app-context.md`
