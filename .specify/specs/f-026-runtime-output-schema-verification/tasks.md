# Implementation Tasks: F-026 Runtime Output Schema Verification

## Task List

### 1. Add Dependencies
- [ ] Add `ajv` and `ajv-formats` to package.json
- [ ] Run `bun install`
- [ ] Verify imports work

### 2. Create Validator Module
- [ ] Create `src/lib/validator.ts`
- [ ] Implement `validateAgainstSchema(schema, data)`
- [ ] Implement `loadContractSchema(toolId, contractName)`
- [ ] Implement `formatValidationErrors(errors)`
- [ ] Export from `src/lib/index.ts`

### 3. Write Validator Tests
- [ ] Create `tests/validator.test.ts`
- [ ] Test valid data passes
- [ ] Test invalid data fails with correct errors
- [ ] Test missing required fields
- [ ] Test type mismatches
- [ ] Test nested object validation
- [ ] Test array validation

### 4. Create verify-output Command
- [ ] Create `src/commands/verify-output.ts`
- [ ] Parse tool and contract arguments
- [ ] Implement `--file` option for file input
- [ ] Implement stdin reading
- [ ] Implement `--generate` option (optional, lower priority)
- [ ] Add JSON output mode
- [ ] Register in `src/index.ts`

### 5. Write Command Tests
- [ ] Create `tests/verify-output.test.ts`
- [ ] Test with valid file input
- [ ] Test with invalid file input
- [ ] Test with stdin input
- [ ] Test JSON output mode
- [ ] Test error cases (missing tool, contract, schema)

### 6. Update Documentation
- [ ] Update README.md with new command
- [ ] Update CLAUDE.md files if needed
- [ ] Create docs.md for this feature

### 7. Final Verification
- [ ] Run all tests (`bun test`)
- [ ] Run typecheck (`bun run typecheck`)
- [ ] Manual testing with real tool output

## Definition of Done

- [ ] `pai-deps verify-output <tool> <contract> --file <path>` validates output
- [ ] Clear error messages with JSON paths for validation failures
- [ ] JSON output mode works
- [ ] All tests pass
- [ ] Typecheck passes
