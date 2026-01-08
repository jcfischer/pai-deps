# Technical Plan: F-012 DOT Graph Generation

## Architecture

### Files to Modify/Create

```
src/
├── commands/
│   └── graph.ts          # NEW: graph command
├── lib/
│   └── dot.ts            # NEW: DOT generation utilities
└── index.ts              # Register graph command
```

## Implementation Approach

### 1. DOT Generation Library

Create `src/lib/dot.ts` with pure functions:

```typescript
interface DotOptions {
  rankdir?: 'LR' | 'TB' | 'BT' | 'RL';
  focusId?: string;
  maxDepth?: number;
}

function generateDot(graph: DependencyGraph, options: DotOptions): string {
  // Build DOT string with proper escaping
}

function nodeColor(type: string): string {
  // Return hex color based on tool type
}

function escapeLabel(name: string): string {
  // Escape special DOT characters
}
```

### 2. Command Structure

```bash
pai-deps graph [options]

Options:
  -o, --output <file>   Write to file instead of stdout
  -f, --format <fmt>    Output format: dot (default), svg
  --focus <tool>        Generate subgraph centered on tool
  --depth <n>           Max depth from focus (default: unlimited)
  --no-color            Disable node coloring
```

### 3. SVG Rendering

For `--format svg`:
1. Check if `dot` command exists (via `which dot`)
2. If missing, error with: "Graphviz not installed. Install with: brew install graphviz"
3. If present, spawn `dot -Tsvg` and pipe DOT input

### 4. Subgraph Generation (--focus)

When `--focus <tool>` is specified:
1. Start BFS from focus tool in both directions
2. Collect nodes within `--depth` hops
3. Include only edges between collected nodes
4. Highlight focus node with bold border

## Testing Strategy

1. DOT syntax validation (parse output)
2. Node/edge count verification
3. Color assignment by type
4. Focus subgraph correctness
5. SVG generation (mock `dot` command)
6. Error handling for missing Graphviz

## Reuse

- DependencyGraph for traversal
- formatTable patterns for output
- Global options (--json outputs DOT as string in JSON)
