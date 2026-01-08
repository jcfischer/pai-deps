# Feature Specification: F-012 DOT Graph Generation

## Problem Statement

Users need to visualize the dependency graph to understand relationships between tools. A visual representation helps identify:
- Critical foundational libraries (many dependents)
- Complex tools with many dependencies
- Potential circular dependencies
- Isolated tools with no connections

## Users & Stakeholders

**Primary User:** PAI developer reviewing architecture
**Use Case:** Understanding and documenting tool relationships

## Current State

- Dependency graph exists in-memory with full adjacency data
- `deps` and `rdeps` commands provide text-based queries
- No visual representation of the graph

## Requirements

### Functional

1. **graph command**: Generate DOT format output
   - `pai-deps graph` - output DOT to stdout
   - `pai-deps graph --output file.dot` - write to file
   - `pai-deps graph --format svg --output file.svg` - render to SVG (requires Graphviz)
   - `pai-deps graph --focus <tool>` - subgraph centered on a tool
   - `--depth N` - limit depth from focus tool

2. **DOT output format**:
   ```dot
   digraph pai_deps {
     rankdir=LR;
     node [shape=box];

     // Nodes with type-based styling
     resona [label="resona\n(library)" style=filled fillcolor="#e1f5fe"];
     email [label="email\n(library)" style=filled fillcolor="#e1f5fe"];
     daily_briefing [label="daily-briefing\n(library)" style=filled fillcolor="#e1f5fe"];

     // Edges
     email -> resona;
     daily_briefing -> email;
   }
   ```

3. **Node styling by type**:
   - `library`: blue fill (#e1f5fe)
   - `cli`: green fill (#e8f5e9)
   - `mcp`: purple fill (#f3e5f5)
   - `stub`: gray fill, dashed border

4. **Edge styling**:
   - Normal dependency: solid arrow
   - Circular dependency: red dashed arrow

5. **SVG rendering** (optional, requires graphviz):
   - Detect if `dot` command available
   - Pipe DOT output through `dot -Tsvg`
   - Error gracefully if graphviz not installed

### Non-Functional

- DOT generation should complete in < 500ms for typical graph
- Output should be valid DOT syntax parseable by Graphviz

## Edge Cases & Error Handling

1. **Empty graph**: Output minimal valid DOT with comment
2. **Graphviz not installed**: Clear error message with install instructions
3. **Focus tool not found**: Error with helpful message
4. **Large graph**: Consider `--limit N` to cap node count

## Success Criteria

1. `pai-deps graph` outputs valid DOT format
2. DOT can be rendered by Graphviz without errors
3. Node colors reflect tool types
4. `--focus` generates correct subgraph
5. SVG output works when Graphviz is installed
