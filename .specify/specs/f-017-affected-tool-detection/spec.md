# F-017: Affected Tool Detection

## Problem Statement

When a tool changes, developers need to know which other tools might be affected by that change. Currently, to answer "what needs retesting if `resona` changes?", users must manually trace reverse dependencies. This is error-prone and doesn't scale as the dependency graph grows.

## Users & Stakeholders

- **Primary**: Developers maintaining PAI tools
- **Secondary**: CI/CD systems running automated tests

## Requirements

### Functional

1. `pai-deps affected <tool>` command returns all tools transitively affected by changes to the specified tool
2. Results ordered by dependency depth (direct dependents first, then their dependents, etc.)
3. Support `--direct` flag to show only direct dependents (not transitive)
4. Support `--json` output for CI integration
5. Exit code 0 if tool found, 1 if tool not found

### Non-Functional

- Performance: O(V + E) graph traversal (already implemented in getTransitiveDependents)
- Output: Clear hierarchical display showing dependency levels

## Success Criteria

1. `pai-deps affected resona` correctly lists all tools that depend on resona
2. `pai-deps affected email --direct` shows only direct dependents
3. JSON output includes dependency depth for each affected tool
4. Tests cover empty graph, single tool, chain, diamond pattern

## Scope

### In Scope

- New `affected` command
- Depth information in output
- Direct vs transitive flag

### Explicitly Out of Scope

- Git integration (detecting changed files) - this is F-022
- Blast radius calculation with reliability - this is F-018
- CI-specific commands - this is F-022
