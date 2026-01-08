# Feature Specification: F-006 - Init Command for Manifest Generation

**Feature ID:** F-006
**Phase:** 1 (Core Registry)
**Priority:** 3
**Estimated Hours:** 2
**Reliability Target:** 0.95
**Dependencies:** F-003 (Manifest parser)

---

## Summary

Implement `pai-deps init <path>` to generate a `pai-manifest.yaml` template file. Auto-detect tool type and name from `package.json` if present. Include example sections for provides and depends_on to guide the user.

---

## User Scenarios

### Scenario 1: Init in Directory with package.json
**Given** a directory with package.json containing name and bin field
**When** running `pai-deps init /path/to/tool`
**Then** creates pai-manifest.yaml with name from package.json
**And** type is "cli" (detected from bin field)
**And** version is from package.json

### Scenario 2: Init in Directory without package.json
**Given** a directory without package.json
**When** running `pai-deps init /path/to/tool`
**Then** creates pai-manifest.yaml with directory name as tool name
**And** type defaults to "cli"
**And** version is "0.1.0"

### Scenario 3: Manifest Already Exists
**Given** pai-manifest.yaml already exists in directory
**When** running `pai-deps init /path/to/tool`
**Then** shows error: "pai-manifest.yaml already exists"
**And** suggests using --force to overwrite
**And** does NOT overwrite the file

### Scenario 4: Force Overwrite
**Given** pai-manifest.yaml already exists
**When** running `pai-deps init /path/to/tool --force`
**Then** overwrites existing manifest with new template

---

## Functional Requirements

### FR-1: Command Syntax
```
pai-deps init <path> [options]

Arguments:
  path           Path to directory to initialize

Options:
  --force        Overwrite existing pai-manifest.yaml
  --name <name>  Override detected name
  --type <type>  Override detected type (cli, mcp, library, workflow, hook)
  --json         Output result as JSON
```

### FR-2: Auto-Detection from package.json
If `package.json` exists in target directory:
1. **name**: Use package name (strip scope like @org/)
2. **version**: Use package version
3. **type**:
   - If `bin` field exists → "cli"
   - If `main` points to MCP server → "mcp" (heuristic: contains "mcp")
   - Otherwise → "library"
4. **description**: Use package description if present

### FR-3: Fallback Defaults
If no package.json or fields missing:
1. **name**: Directory basename
2. **version**: "0.1.0"
3. **type**: "cli"
4. **description**: empty

### FR-4: Generated Manifest Template
```yaml
# PAI Dependency Manifest
# Documentation: https://github.com/pai/pai-deps

name: <detected-name>
version: <detected-version>
type: <detected-type>
description: <detected-description>

# What this tool provides to other tools
provides:
  # CLI commands (uncomment and customize)
  # cli:
  #   - command: "<name> <subcommand>"
  #     output_schema: ./schemas/output.json

  # MCP tools (uncomment if MCP server)
  # mcp:
  #   - tool: "<tool_name>"
  #     schema: ./schemas/tool.json

# Dependencies on other PAI tools
depends_on: []
  # Example:
  # - name: resona
  #   type: library
  #   version: ">=1.0.0"

# Reliability estimate (0.0 - 1.0)
reliability: 0.95

# Technical debt score (from SpecKit)
debt_score: 0
```

### FR-5: Output
**Human-readable:**
```
Created pai-manifest.yaml
  Name: email
  Type: cli
  Version: 1.2.0

Next steps:
  1. Edit pai-manifest.yaml to add provides and depends_on
  2. Run: pai-deps register /path/to/tool
```

**JSON:**
```json
{
  "success": true,
  "action": "created",
  "path": "/path/to/tool/pai-manifest.yaml",
  "manifest": {
    "name": "email",
    "type": "cli",
    "version": "1.2.0"
  }
}
```

---

## Non-Functional Requirements

### NFR-1: Safety
- MUST NOT overwrite existing manifest without --force

### NFR-2: Valid Output
- Generated YAML MUST be valid according to F-003 schema (except for commented sections)

---

## Acceptance Criteria

- [ ] Creates valid pai-manifest.yaml template
- [ ] Detects name, version, type from package.json
- [ ] Detects CLI vs library from bin field
- [ ] Uses directory name when no package.json
- [ ] Does not overwrite existing manifest without --force
- [ ] --force overwrites existing manifest
- [ ] Template includes commented example sections
- [ ] All tests pass

---

## Out of Scope

- Interactive prompts (keep it non-interactive)
- Full manifest auto-generation with dependency analysis (F-025)
- Validation of generated manifest

---

## References

- F-003: Manifest specification
- Design Doc: `/Users/fischer/work/kai-improvement-roadmap/design-pai-dependency-tracker.md`
