# Technical Plan: F-003 - Manifest Specification and Zod Parser

**Feature ID:** F-003
**Phase:** 1 (Core Registry)
**Estimated Hours:** 3

---

## Approach

Use Zod for schema definition and validation, yaml package for YAML parsing, and zod-to-json-schema for JSON Schema generation. This gives us:
- Type-safe schema definition in TypeScript
- Automatic TypeScript type inference
- Rich validation error messages
- JSON Schema generation for IDE support

---

## Technical Design

### Architecture

```
src/lib/
├── manifest.ts      # Zod schema, types, parseManifest(), validateManifest()
└── yaml.ts          # YAML parsing utilities (thin wrapper)

schemas/
└── manifest.json    # Generated JSON Schema
```

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| zod | ^3.22.0 | Schema definition and validation |
| yaml | ^2.4.0 | YAML parsing |
| zod-to-json-schema | ^3.22.0 | JSON Schema generation |

### Schema Definition (`src/lib/manifest.ts`)

```typescript
import { z } from 'zod';

// Tool types
const ToolTypeSchema = z.enum(['cli', 'mcp', 'library', 'workflow', 'hook', 'cli+mcp']);

// Dependency types
const DependencyTypeSchema = z.enum(['cli', 'mcp', 'library', 'database', 'npm', 'implicit']);

// CLI provides
const CliProvidesSchema = z.object({
  command: z.string(),
  output_schema: z.string().optional(),
});

// MCP provides
const McpToolProvidesSchema = z.object({
  tool: z.string(),
  schema: z.string().optional(),
});

const McpResourceProvidesSchema = z.object({
  resource: z.string(),
  schema: z.string().optional(),
});

const McpProvidesSchema = z.union([McpToolProvidesSchema, McpResourceProvidesSchema]);

// Library provides
const LibraryProvidesSchema = z.object({
  export: z.string(),
  path: z.string().optional(),
});

// Database provides
const DatabaseProvidesSchema = z.object({
  path: z.string(),
  schema: z.string().optional(),
});

// Provides section
const ProvidesSectionSchema = z.object({
  cli: z.array(CliProvidesSchema).optional(),
  mcp: z.array(McpProvidesSchema).optional(),
  library: z.array(LibraryProvidesSchema).optional(),
  database: z.array(DatabaseProvidesSchema).optional(),
}).optional();

// Depends on entry
const DependsOnEntrySchema = z.object({
  name: z.string(),
  type: DependencyTypeSchema,
  version: z.string().optional(),
  import: z.string().optional(),
  commands: z.array(z.string()).optional(),
  optional: z.boolean().default(false),
});

// Full manifest schema
export const ManifestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  version: z.string().optional(),
  type: ToolTypeSchema,
  description: z.string().optional(),
  provides: ProvidesSectionSchema,
  depends_on: z.array(DependsOnEntrySchema).optional().default([]),
  reliability: z.number().min(0).max(1).default(0.95),
  debt_score: z.number().int().min(0).default(0),
});

// Inferred types
export type Manifest = z.infer<typeof ManifestSchema>;
export type ProvidesSection = z.infer<typeof ProvidesSectionSchema>;
export type DependsOnEntry = z.infer<typeof DependsOnEntrySchema>;
export type CliProvides = z.infer<typeof CliProvidesSchema>;
export type McpProvides = z.infer<typeof McpProvidesSchema>;
export type LibraryProvides = z.infer<typeof LibraryProvidesSchema>;
export type DatabaseProvides = z.infer<typeof DatabaseProvidesSchema>;
export type ToolType = z.infer<typeof ToolTypeSchema>;
export type DependencyType = z.infer<typeof DependencyTypeSchema>;
```

### Parse Function

```typescript
import { parse as parseYaml } from 'yaml';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function parseManifest(filePath: string): Manifest {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(content);
  const result = ManifestSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid manifest at ${filePath}:\n${errors}`);
  }

  return result.data;
}

export function validateManifest(content: unknown):
  | { success: true; data: Manifest }
  | { success: false; error: z.ZodError } {
  const result = ManifestSchema.safeParse(content);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
```

### JSON Schema Generation

```typescript
// scripts/generate-schema.ts
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ManifestSchema } from '../src/lib/manifest';
import { writeFileSync } from 'node:fs';

const jsonSchema = zodToJsonSchema(ManifestSchema, {
  name: 'PaiManifest',
  $refStrategy: 'none', // Inline all definitions
});

writeFileSync(
  './schemas/manifest.json',
  JSON.stringify(jsonSchema, null, 2)
);
```

---

## Failure Mode Analysis

### How This Code Can Fail

| Failure Mode | Trigger | Detection | Degradation | Recovery |
|--------------|---------|-----------|-------------|----------|
| YAML syntax error | Malformed YAML | yaml.parse throws | Clear syntax error | User fixes YAML |
| Missing required field | name/type omitted | Zod validation fails | Field-specific error | User adds field |
| Invalid type enum | type: "invalid" | Zod validation fails | Lists valid options | User corrects |
| File not found | Path doesn't exist | readFileSync throws | Clear file error | User fixes path |

### Assumptions That Could Break

| Assumption | What Would Invalidate It | Detection Strategy |
|------------|-------------------------|-------------------|
| YAML 1.2 syntax | YAML 1.1 edge cases | Test with edge cases |
| UTF-8 encoding | Non-UTF8 files | Add encoding validation |
| Reasonable file size | Very large manifests | Test with large files |

### Blast Radius

- **Files touched:** 3 new files (manifest.ts, yaml.ts, tests)
- **Systems affected:** None external
- **Rollback strategy:** Delete files, no external state

---

## Implementation Steps

1. Add Zod, yaml, zod-to-json-schema dependencies
2. Create `src/lib/manifest.ts` with full Zod schema
3. Implement `parseManifest()` function
4. Implement `validateManifest()` function
5. Create `scripts/generate-schema.ts`
6. Generate `schemas/manifest.json`
7. Add npm script for schema generation
8. Create comprehensive tests
9. Update exports from src/lib/index.ts (if exists)

---

## Testing Strategy

### Unit Tests

```typescript
// tests/manifest.test.ts
import { describe, test, expect } from 'bun:test';
import { parseManifest, validateManifest, ManifestSchema } from '../src/lib/manifest';

describe('Manifest Parser', () => {
  test('parses valid minimal manifest', () => {
    const result = validateManifest({
      name: 'test-tool',
      type: 'cli',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('test-tool');
      expect(result.data.reliability).toBe(0.95); // default
      expect(result.data.debt_score).toBe(0); // default
    }
  });

  test('parses full manifest with all fields', () => {
    const result = validateManifest({
      name: 'email',
      version: '1.2.0',
      type: 'cli+mcp',
      description: 'Email client',
      provides: {
        cli: [{ command: 'email search', output_schema: './schemas/search.json' }],
        mcp: [{ tool: 'email_search', schema: './schemas/mcp.json' }],
      },
      depends_on: [
        { name: 'resona', type: 'library', version: '>=1.0.0' },
      ],
      reliability: 0.98,
      debt_score: 6,
    });
    expect(result.success).toBe(true);
  });

  test('rejects missing name', () => {
    const result = validateManifest({ type: 'cli' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('name');
    }
  });

  test('rejects invalid type', () => {
    const result = validateManifest({ name: 'test', type: 'invalid' });
    expect(result.success).toBe(false);
  });

  test('rejects reliability out of range', () => {
    const result = validateManifest({
      name: 'test',
      type: 'cli',
      reliability: 1.5,
    });
    expect(result.success).toBe(false);
  });
});
```

---

## Doctorow Gate Checklist

- [ ] **Failure test:** What happens with malformed YAML? (clear syntax error)
- [ ] **Failure test:** What happens with missing file? (clear file error)
- [ ] **Assumption test:** Does it work with complex nested YAML? (test coverage)
- [ ] **Rollback test:** Can we remove the feature cleanly? (yes, no external state)
- [ ] **Debt recorded:** Score 3 (adds dependency on zod, yaml packages)

---

## References

- Spec: `/Users/fischer/work/pai-deps/.specify/specs/f-003-manifest-specification-and-zod-parser/spec.md`
- Zod Docs: https://zod.dev/
- zod-to-json-schema: https://github.com/StefanTerdell/zod-to-json-schema
