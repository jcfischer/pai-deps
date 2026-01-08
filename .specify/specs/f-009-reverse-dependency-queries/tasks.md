# Implementation Tasks: F-009 Reverse Dependency Queries (rdeps)

## Task 1: Add reverse traversal to graph algorithms

Update `src/lib/graph/algorithms.ts`:

1. Add `getReverseDependencies()` function:
   - Accept graph, toolId, options (transitive, maxDepth)
   - BFS traversal following reverse edges
   - Track visited nodes to handle cycles
   - Return array of { id, name, type, depth }

2. Build reverse adjacency on-the-fly:
   - Iterate through all edges
   - Create Map<providerId, consumerId[]>
   - Use for reverse lookup

## Task 2: Create rdeps command

Create `src/commands/rdeps.ts`:

1. Command definition:
   - `rdeps <tool>` - required tool argument
   - `-t, --transitive` - include transitive dependents
   - `-d, --depth <n>` - max depth (only with transitive)

2. Implementation:
   - Load graph from database
   - Call getReverseDependencies()
   - Format output (table or JSON)

3. Output format matching deps command:
   - Same table columns: ID, Name, Type, Reliability, Depth
   - Same JSON structure

## Task 3: Register command in CLI

Update `src/index.ts`:
1. Import rdepsCommand
2. Register with program

## Task 4: Add tests

Create `tests/rdeps.test.ts`:

1. Test direct dependents only
2. Test transitive dependents
3. Test depth limiting
4. Test tool with no dependents
5. Test non-existent tool
6. Test circular dependency handling
7. Test JSON output format

## Verification

```bash
bun test
bun run typecheck

# Manual testing
pai-deps rdeps resona
pai-deps rdeps resona --transitive
pai-deps rdeps email --transitive --depth 1
pai-deps rdeps nonexistent  # should error
```
