# Feature Specification: F-026 Runtime Output Schema Verification

## Problem Statement

F-014 detects when schema FILES change (drift detection), but doesn't verify that actual tool outputs conform to their declared schemas. A tool could have a valid schema file but produce output that doesn't match it. We need runtime validation to catch this.

## Users & Stakeholders

- **Primary**: Developers maintaining PAI tools who want to ensure contract compliance
- **Secondary**: CI pipelines that need to validate tool outputs automatically

## Current State

- Tools declare output schemas in `pai-manifest.yaml` via `schema_path`
- F-014's `drift` command compares schema file hashes
- No mechanism exists to validate actual outputs against schemas
- The `verify` command (F-013) checks CLI contracts but not output content

## Requirements

### Functional

1. **`pai-deps verify-output <tool> <contract>`** - Validate sample output against schema
   - Accept output via stdin or `--file` option
   - Load the contract's JSON schema
   - Validate output against schema
   - Report validation errors with paths

2. **`pai-deps verify-output --generate <tool> <contract>`** - Generate sample output
   - Use JSON Schema to generate valid sample data
   - Useful for testing and documentation

3. **Integration with existing verify command**
   - `pai-deps verify <tool> --with-output <file>` - Verify CLI contract AND validate output

### Non-Functional

- Use Ajv for JSON Schema validation (fast, well-maintained)
- Support JSON Schema draft-07 (most common)
- Exit code 0 for valid, 1 for invalid
- JSON output mode for programmatic use

## User Experience

```bash
# Validate output from a file
pai-deps verify-output email-mcp email_search --file sample-output.json

# Validate output from stdin (pipe from actual tool)
echo '{"results": [...]}' | pai-deps verify-output email-mcp email_search

# Generate sample valid output
pai-deps verify-output email-mcp email_search --generate

# Integrated verification
pai-deps verify email-mcp --with-output actual-output.json
```

### Error Output

```
Validation failed for email-mcp:email_search

Errors:
  - /results/0/date: must be string (got number)
  - /results/0/subject: required property missing

Schema: schemas/email_search.json
```

## Edge Cases & Error Handling

- Schema file not found → Clear error with path
- Invalid JSON input → Parse error with line/column
- Schema itself invalid → Validation error for schema
- Empty output → Depends on schema (may be valid)
- Large output files → Stream validation if needed

## Success Criteria

- [ ] Can validate JSON output against declared schema
- [ ] Reports specific validation errors with JSON paths
- [ ] Integrates with existing verify workflow
- [ ] Supports both file and stdin input
- [ ] JSON output mode for CI integration
- [ ] 90%+ test coverage

## Scope

### In Scope
- JSON Schema validation using Ajv
- CLI command for output validation
- Integration with verify command
- JSON and human-readable output modes

### Explicitly Out of Scope
- XML or other format validation
- Auto-capture of tool outputs (manual input only)
- Schema generation from output samples
- Breaking change detection between schema versions

## Open Questions

None - straightforward JSON Schema validation.
