# Feature Specification: F-005 - Unregister, List, and Show Commands

**Feature ID:** F-005
**Phase:** 1 (Core Registry)
**Priority:** 4
**Estimated Hours:** 3
**Reliability Target:** 0.95
**Dependencies:** F-004 (Register command)

---

## Summary

Implement three essential commands for viewing and managing registered tools:
- `pai-deps list` - Show all registered tools in ASCII table format
- `pai-deps show <tool>` - Display detailed information about a specific tool
- `pai-deps unregister <tool>` - Remove a tool and its dependency edges

---

## User Scenarios

### Scenario 1: List All Tools
**Given** several tools are registered
**When** running `pai-deps list`
**Then** an ASCII table shows all tools with key info
**And** stubs are marked with [stub] indicator
**And** output is sorted by name

### Scenario 2: List Empty Registry
**Given** no tools are registered
**When** running `pai-deps list`
**Then** message shows "No tools registered"
**And** exit code is 0

### Scenario 3: Show Tool Details
**Given** tool "email" is registered
**When** running `pai-deps show email`
**Then** displays name, version, type, path
**And** displays dependencies with their types
**And** displays reliability and debt score
**And** shows provides (CLI commands, MCP tools)

### Scenario 4: Show Non-Existent Tool
**Given** tool "unknown" is not registered
**When** running `pai-deps show unknown`
**Then** error message shows "Tool 'unknown' not found"
**And** exit code is 1

### Scenario 5: Unregister Tool
**Given** tool "email" is registered
**When** running `pai-deps unregister email`
**Then** tool is removed from database
**And** dependency edges (as consumer) are removed
**And** success message confirms removal

### Scenario 6: Unregister with Dependents
**Given** tool "resona" has tools depending on it
**When** running `pai-deps unregister resona`
**Then** warning shows which tools depend on it
**And** user must confirm with --force flag
**And** without --force, exits without unregistering

---

## Functional Requirements

### FR-1: List Command

```
pai-deps list [options]

Options:
  --type <type>    Filter by tool type (cli, mcp, library, workflow, hook)
  --stubs          Show only stub entries
  --no-stubs       Hide stub entries
  --json           Output as JSON array
```

**ASCII Table Format:**
```
ID         Type     Version  Deps  Reliability  Debt  Status
─────────────────────────────────────────────────────────────
email      cli+mcp  1.2.0    3     0.95         6     ●
resona     library  2.0.0    1     0.98         2     ●
supertag   cli      -        0     0.95         0     [stub]
─────────────────────────────────────────────────────────────
3 tools (1 stub)
```

**JSON Format:**
```json
{
  "success": true,
  "tools": [
    {
      "id": "email",
      "type": "cli+mcp",
      "version": "1.2.0",
      "dependencies": 3,
      "reliability": 0.95,
      "debtScore": 6,
      "stub": false
    }
  ],
  "total": 3,
  "stubs": 1
}
```

### FR-2: Show Command

```
pai-deps show <tool> [options]

Arguments:
  tool            Tool ID to show details for

Options:
  --json          Output as JSON
```

**Human-Readable Format:**
```
Tool: email
Version: 1.2.0
Type: cli+mcp
Path: /Users/fischer/work/DA/KAI/skills/email

Reliability: 0.95
Debt Score: 6
Last Verified: 2026-01-07T21:30:00Z

Dependencies (3):
  ├── resona (library) >=1.0.0
  ├── drizzle-orm (npm) ^0.29.0
  └── nodemailer (npm) ^6.9.0

Provides:
  CLI Commands:
    ├── email search --json
    └── email stats --json
  MCP Tools:
    └── email_search
```

**JSON Format:**
```json
{
  "success": true,
  "tool": {
    "id": "email",
    "name": "email",
    "version": "1.2.0",
    "type": "cli+mcp",
    "path": "/path/to/email",
    "manifestPath": "/path/to/email/pai-manifest.yaml",
    "reliability": 0.95,
    "debtScore": 6,
    "stub": false,
    "lastVerified": "2026-01-07T21:30:00Z",
    "createdAt": "2026-01-07T20:00:00Z",
    "updatedAt": "2026-01-07T21:00:00Z"
  },
  "dependencies": [
    { "name": "resona", "type": "library", "version": ">=1.0.0", "optional": false }
  ],
  "dependents": [],
  "provides": {
    "cli": [{ "command": "email search", "outputSchema": "./schemas/search.json" }],
    "mcp": [{ "tool": "email_search" }]
  }
}
```

### FR-3: Unregister Command

```
pai-deps unregister <tool> [options]

Arguments:
  tool            Tool ID to unregister

Options:
  --force         Force removal even if other tools depend on it
  --json          Output as JSON
```

**Behavior:**
1. Check if tool exists (error if not)
2. Find tools that depend on this one (dependents)
3. If dependents exist and no --force:
   - Show warning with dependent list
   - Exit without removing
4. If --force or no dependents:
   - Delete tool (cascade deletes dependencies where consumer_id = tool)
   - Note: Dependencies where provider_id = tool remain (pointing to removed tool)
5. Return success message

**JSON Format:**
```json
{
  "success": true,
  "action": "unregistered",
  "tool": "email",
  "affectedDependents": ["daily-briefing"]
}
```

---

## Non-Functional Requirements

### NFR-1: Performance
- List command MUST complete in < 100ms for < 100 tools
- Show command MUST complete in < 50ms

### NFR-2: Output Quality
- ASCII table MUST align columns properly
- Unicode box-drawing characters for tree structure

---

## Acceptance Criteria

- [ ] `pai-deps list` shows ASCII table of all tools
- [ ] `pai-deps list --json` outputs JSON array
- [ ] `pai-deps show <tool>` displays tool details with dependencies
- [ ] `pai-deps show` with non-existent tool shows error
- [ ] `pai-deps unregister <tool>` removes tool from database
- [ ] Unregistering tool with dependents requires --force
- [ ] All commands support --json flag
- [ ] Stubs marked clearly in list output

---

## Out of Scope

- Batch unregister
- Interactive selection
- Dependency visualization (F-012)

---

## References

- F-004: Register command
- Design Doc: `/Users/fischer/work/kai-improvement-roadmap/design-pai-dependency-tracker.md`
