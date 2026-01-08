# src/lib/ - Core Business Logic

Library modules containing the core functionality. All exports are re-exported from `index.ts`.

## Module Overview

| Module | Purpose |
|--------|---------|
| `manifest.ts` | YAML parsing and Zod validation for pai-manifest.yaml |
| `output.ts` | Logging utilities, global options management |
| `verifier.ts` | CLI contract verification (runs commands with --help) |
| `hasher.ts` | JSON normalization and SHA256 hashing for drift detection |
| `validator.ts` | JSON Schema validation using Ajv for output verification |
| `dot.ts` | DOT graph generation for Graphviz |
| `discovery.ts` | Filesystem traversal to find pai-manifest.yaml files |
| `analyzer.ts` | Source code analysis for auto-generating manifests |
| `registry.ts` | Tool registration logic |
| `graph/` | Dependency graph data structure and algorithms |

## Key Patterns

### Manifest Parsing
```typescript
import { parseManifest, ManifestParseError } from './manifest.js';

try {
  const manifest = await parseManifest('/path/to/pai-manifest.yaml');
} catch (err) {
  if (err instanceof ManifestParseError) {
    // Handle validation errors
  }
}
```

### Output Utilities
```typescript
import { getGlobalOptions, output, debug, warn, error } from './output.js';

const opts = getGlobalOptions(); // { json, quiet, verbose }

debug('Only shown with --verbose');
warn('Warning message');
error('Error message');
output({ data: 'Formatted based on --json flag' });
```

### Schema Hashing
```typescript
import { hashJson, hashSchemaFile, compareHashes } from './hasher.js';

const result = hashJson({ type: 'object' });
// { hash: 'abc123...', normalized: '{"type":"object"}' }

const comparison = compareHashes(storedHash, currentHash);
// { status: 'unchanged' | 'drift' | 'new' | 'missing' | 'error' }
```

### Schema Validation
```typescript
import { validateAgainstSchema, loadContractSchema, formatValidationErrors } from './validator.js';

// Validate data against a schema
const result = validateAgainstSchema(schema, data);
if (!result.valid) {
  console.log(formatValidationErrors(result.errors!));
}

// Load schema from a contract
const schemaResult = await loadContractSchema('email-mcp', 'email_search');
if (schemaResult.success) {
  const validation = validateAgainstSchema(schemaResult.schema!, outputData);
}
```

### DOT Generation
```typescript
import { generateDot } from './dot.js';

const dot = generateDot(graph, {
  focus: 'email',      // Highlight specific tool
  depth: 2,            // Limit depth from focus
  noColor: false,      // Enable colors
});
```

## Exports (from index.ts)

All public APIs are re-exported from `./index.ts`:
- Manifest schemas and parser
- Output utilities
- DependencyGraph class
- DOT generation
- Schema hasher functions
- Schema validator functions

## Adding New Modules

1. Create the module file (e.g., `src/lib/newmodule.ts`)
2. Add exports to `src/lib/index.ts`
3. Add tests in `tests/newmodule.test.ts`
