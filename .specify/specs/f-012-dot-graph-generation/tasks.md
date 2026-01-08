# Implementation Tasks: F-012 DOT Graph Generation

## Task 1: Create DOT generation library

Create `src/lib/dot.ts`:

1. Define types:
   ```typescript
   interface DotOptions {
     rankdir?: 'LR' | 'TB';
     focusId?: string;
     maxDepth?: number;
     noColor?: boolean;
   }
   ```

2. Implement `generateDot(graph, options)`:
   - Generate DOT header with rankdir
   - Iterate nodes, generate node declarations with styling
   - Iterate edges, generate edge declarations
   - Return complete DOT string

3. Implement helper functions:
   - `getNodeColor(type: string): string`
   - `escapeId(id: string): string` - escape special chars for DOT IDs
   - `escapeLabel(label: string): string` - escape for labels

4. Export from `src/lib/index.ts`

## Task 2: Implement focus subgraph

Add to `src/lib/dot.ts`:

1. `getSubgraphNodes(graph, focusId, maxDepth)`:
   - BFS forward from focus (dependencies)
   - BFS backward from focus (dependents)
   - Collect all nodes within depth limit
   - Return Set of node IDs

2. Modify `generateDot` to filter nodes/edges when focusId provided

## Task 3: Create graph command

Create `src/commands/graph.ts`:

1. Command definition:
   - `graph` (no required args)
   - `-o, --output <file>` - output file path
   - `-f, --format <fmt>` - dot or svg
   - `--focus <tool>` - center on tool
   - `--depth <n>` - depth limit
   - `--no-color` - disable colors

2. Implementation:
   - Load graph from database
   - Call generateDot with options
   - If format=svg, pipe through Graphviz
   - Write to file or stdout

3. SVG rendering:
   - Check `which dot` to verify Graphviz
   - Spawn `dot -Tsvg` subprocess
   - Handle errors gracefully

## Task 4: Register command

Update `src/index.ts`:
1. Import graphCommand
2. Register with program

## Task 5: Add tests

Create `tests/graph.test.ts`:

1. Test DOT output validity
2. Test node styling by type
3. Test edge generation
4. Test focus subgraph
5. Test depth limiting
6. Test escaping special characters
7. Test empty graph handling

## Verification

```bash
bun test
bun run typecheck

# Manual testing
pai-deps graph > deps.dot
dot -Tsvg deps.dot > deps.svg  # if graphviz installed

pai-deps graph --focus resona --depth 2
pai-deps graph --format svg --output deps.svg
```
