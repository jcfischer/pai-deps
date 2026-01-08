# Technical Plan: F-026 Runtime Output Schema Verification

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Layer                             │
│  verify-output <tool> <contract> [--file|--generate]    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Validator Module                        │
│  src/lib/validator.ts                                   │
│  - loadSchema(contractId)                               │
│  - validateOutput(schema, data)                         │
│  - formatErrors(errors)                                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Ajv Library                          │
│  - JSON Schema draft-07 validation                      │
│  - Detailed error messages with paths                   │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── commands/
│   └── verify-output.ts    # New command
├── lib/
│   └── validator.ts        # New validation module
└── index.ts                # Register command
```

## Implementation Details

### 1. Validator Module (`src/lib/validator.ts`)

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

// Create Ajv instance with formats (email, uri, date-time, etc.)
const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

export function validateAgainstSchema(
  schema: object,
  data: unknown
): ValidationResult;

export function loadContractSchema(
  toolId: string,
  contractName: string
): Promise<object | null>;

export function formatValidationErrors(
  errors: ValidationError[]
): string;
```

### 2. Command (`src/commands/verify-output.ts`)

```typescript
interface VerifyOutputOptions {
  file?: string;
  generate?: boolean;
}

// pai-deps verify-output <tool> <contract> [options]
export function verifyOutputCommand(program: Command): void;
```

**Flow:**
1. Parse tool and contract from args
2. Load contract from database
3. Resolve schema path relative to tool path
4. Load and parse schema JSON
5. Read input (stdin or file)
6. Validate with Ajv
7. Output results (human or JSON)

### 3. Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1"
  }
}
```

### 4. Integration with Verify Command

Extend existing `verify.ts`:
```typescript
interface VerifyOptions {
  // existing...
  withOutput?: string;  // Add this
}
```

When `--with-output` is provided:
1. Run normal CLI verification
2. If passes, also validate the output file against schema

## Error Handling

| Error | Response |
|-------|----------|
| Tool not found | Exit 1, "Tool 'X' not found" |
| Contract not found | Exit 1, "Contract 'X' not found for tool 'Y'" |
| No schema_path | Exit 1, "Contract has no schema defined" |
| Schema file missing | Exit 1, "Schema file not found: path" |
| Invalid schema | Exit 1, "Invalid JSON Schema: error" |
| Invalid input JSON | Exit 1, "Invalid JSON: parse error" |
| Validation fails | Exit 1, formatted errors |
| Validation passes | Exit 0, "Output valid" |

## Testing Strategy

1. **Unit tests for validator.ts**
   - Valid output passes
   - Invalid output fails with correct errors
   - Missing required fields detected
   - Type mismatches detected

2. **Integration tests for command**
   - File input works
   - Stdin input works
   - JSON output mode
   - Error cases

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large schema files slow | Ajv compiles schemas, cache compiled |
| Complex nested errors hard to read | Flatten to JSON paths |
| Schema draft version mismatch | Default to draft-07, document |
