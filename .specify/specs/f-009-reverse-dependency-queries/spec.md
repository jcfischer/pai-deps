# Feature Specification: F-009 Reverse Dependency Queries (rdeps)

## Problem Statement

Users need to answer "what breaks if I change this tool?" - the reverse of the `deps` command. When modifying `resona`, they need to know that `email`, `supertag-cli`, `ragent`, and others depend on it.

## Users & Stakeholders

**Primary User:** PAI developer making changes to shared libraries/tools
**Use Case:** Impact analysis before modifying a tool

## Current State

- `deps` command shows forward dependencies (what a tool needs)
- No way to query reverse dependencies (what needs a tool)
- Graph data structure exists with adjacency lists

## Requirements

### Functional

1. **rdeps command**: Show all tools that depend on a given tool
   - `pai-deps rdeps <tool>` - list direct dependents
   - `--transitive` - include transitive dependents (tools that depend on dependents)
   - `--depth N` - limit traversal depth (default: unlimited with transitive)
   - `--json` - JSON output for scripting

2. **Output format** (human-readable):
   ```
   Reverse dependencies for: resona (transitive)

   ID              Name            Type     Depth
   ───────────────────────────────────────────────
   email           email           library  1
   supertag-cli    supertag-cli    cli      1
   ragent          ragent          cli      1
   daily-briefing  daily-briefing  library  2

   Total: 4 dependents (max depth: 2)
   ```

3. **JSON output**:
   ```json
   {
     "tool": "resona",
     "transitive": true,
     "rdeps": [
       { "id": "email", "type": "library", "depth": 1 },
       { "id": "supertag-cli", "type": "cli", "depth": 1 }
     ],
     "total": 4,
     "maxDepth": 2
   }
   ```

### Non-Functional

- Query should complete in < 100ms for typical PAI graph size
- Reuse existing graph infrastructure

## Edge Cases & Error Handling

1. **Tool not found**: Error with helpful message
2. **No dependents**: "No tools depend on <tool>"
3. **Circular dependencies**: Handle gracefully, don't infinite loop
4. **Self-reference**: Exclude tool from its own rdeps

## Success Criteria

1. Can answer "what depends on resona?" in one command
2. Transitive query shows full impact (depth 2+)
3. Output matches `deps` command format for consistency
