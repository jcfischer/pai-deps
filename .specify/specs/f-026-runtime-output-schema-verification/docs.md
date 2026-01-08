# Documentation Updates for F-026 Runtime Output Schema Verification

## Files Updated

- **README.md**:
  - Added `verify-output` command to commands table
  - Updated test count (301 → 315)

- **src/lib/index.ts**:
  - Added exports for validator module (validateAgainstSchema, loadSchemaFile, loadContractSchema, formatValidationErrors)

## New Files Created

- **src/lib/validator.ts**: JSON Schema validation using Ajv
  - `validateAgainstSchema(schema, data)` - Validate data against JSON Schema
  - `loadSchemaFile(path)` - Load and parse schema file
  - `loadContractSchema(toolId, contractName)` - Load schema from contract
  - `formatValidationErrors(errors)` - Human-readable error formatting

- **src/commands/verify-output.ts**: CLI command
  - `pai-deps verify-output <tool> <contract> [--file <path>]`
  - Validates output against declared schema
  - Supports file input or stdin
  - JSON output mode for CI

- **tests/validator.test.ts**: 14 tests covering validation logic

## API Changes

New exports from `src/lib/index.ts`:
- `validateAgainstSchema(schema: object, data: unknown): ValidationResult`
- `loadSchemaFile(schemaPath: string): Promise<object | null>`
- `loadContractSchema(toolId: string, contractName: string): Promise<SchemaLoadResult>`
- `formatValidationErrors(errors: ValidationError[]): string`

## CLI Changes

New command: `pai-deps verify-output <tool> <contract>`
- Options: `--file <path>` (read from file), `--json` (JSON output)
- Exit codes: 0 (valid), 1 (invalid or error)

## Dependencies Added

- `ajv@8.17.1` - JSON Schema validator
- `ajv-formats@3.0.1` - Format validation (email, uri, date-time, etc.)
