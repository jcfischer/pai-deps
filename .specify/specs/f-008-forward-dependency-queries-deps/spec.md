# Feature Specification: F-008 - Forward Dependency Queries (deps)

**Feature ID:** F-008
**Phase:** 3 (Query Commands)
**Priority:** 5
**Estimated Hours:** 2
**Reliability Target:** 0.95
**Dependencies:** F-007 (In-memory dependency graph)

---

## Summary

Implement the `pai-deps deps <tool>` CLI command that queries forward dependencies - tools that the specified tool depends on. Supports both direct dependencies and transitive (recursive) dependencies.

---

## User Scenarios

### Scenario 1: Query Direct Dependencies
**Given** tools are registered with dependencies
**When** running `pai-deps deps daily-briefing`
**Then** shows tools that daily-briefing directly depends on
**And** output shows tool name, type, and reliability

### Scenario 2: Query Transitive Dependencies
**Given** tools form a dependency chain: A -> B -> C
**When** running `pai-deps deps A --transitive`
**Then** shows both B and C (all reachable dependencies)
**And** shows depth level for each tool

### Scenario 3: JSON Output
**Given** tools are registered with dependencies
**When** running `pai-deps deps daily-briefing --json`
**Then** outputs valid JSON with dependency array
**And** includes tool metadata for each dependency

### Scenario 4: Unknown Tool
**Given** tool "unknown" is not registered
**When** running `pai-deps deps unknown`
**Then** shows error: "Tool 'unknown' not found"
**And** exits with non-zero code

### Scenario 5: No Dependencies
**Given** tool "standalone" has no dependencies
**When** running `pai-deps deps standalone`
**Then** shows message: "Tool has no dependencies"
**And** exits with success code

---

## Functional Requirements

### FR-1: Command Signature
```bash
pai-deps deps <tool> [options]

Options:
  --transitive, -t    Include transitive dependencies (default: false)
  --json              Output as JSON
```

### FR-2: Table Output Format (default)
```
Dependencies for: daily-briefing

ID          Name          Type       Reliability
──────────────────────────────────────────────────
ical        ical          cli        0.95
supertag    supertag-cli  cli        0.95
email       email-mcp     mcp        0.95
ragent      ragent        cli        0.90
resona      resona        library    0.95

Total: 5 dependencies
```

### FR-3: Transitive Output Format
```
Dependencies for: daily-briefing (transitive)

ID          Name          Type       Reliability  Depth
─────────────────────────────────────────────────────────
ical        ical          cli        0.95         1
supertag    supertag-cli  cli        0.95         1
email       email-mcp     mcp        0.95         1
ragent      ragent        cli        0.90         1
resona      resona        library    0.95         1
chromadb    chromadb      library    0.95         2

Total: 6 dependencies (depth: 2)
```

### FR-4: JSON Output Format
```json
{
  "tool": "daily-briefing",
  "transitive": false,
  "dependencies": [
    {
      "id": "ical",
      "name": "ical",
      "type": "cli",
      "reliability": 0.95
    }
  ],
  "count": 5
}
```

### FR-5: Error Handling
- Unknown tool: error message + exit code 1
- No dependencies: success message + exit code 0
- Database error: error message + exit code 1

---

## Non-Functional Requirements

### NFR-1: Performance
- Query completes in < 100ms for graphs with 100 tools

### NFR-2: Consistency
- Output format matches other pai-deps commands
- JSON schema consistent with `pai-deps show` output

---

## Acceptance Criteria

- [ ] `pai-deps deps <tool>` shows direct dependencies
- [ ] `pai-deps deps <tool> --transitive` shows all reachable dependencies
- [ ] `pai-deps deps <tool> --json` outputs valid JSON
- [ ] Unknown tool returns error
- [ ] No dependencies shows appropriate message
- [ ] Exit codes are correct (0 success, 1 error)
- [ ] All tests pass

---

## Out of Scope

- Filtering by dependency type (future feature)
- Limiting depth for transitive queries (future feature)
- Cycle detection in deps output (handled by separate command)

---

## References

- F-007: In-memory dependency graph (provides `getDependencies`, `getTransitiveDependencies`)
- Design Doc: CLI commands section
