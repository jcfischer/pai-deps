# Implementation Tasks: F-014 Schema Hashing and Drift Detection

## Tasks

### 1. Create schema hasher utility
- [ ] Create `src/lib/hasher.ts`
- [ ] Implement `normalizeJson()` for deterministic hashing
- [ ] Implement `hashJson()` with SHA256
- [ ] Implement `hashSchemaFile()` to hash a JSON Schema file
- [ ] Implement `detectFieldChanges()` for basic field-level diff

### 2. Create drift command
- [ ] Create `src/commands/drift.ts`
- [ ] Implement single-tool drift detection
- [ ] Implement `--all` flag for checking all tools
- [ ] Implement `--update` flag for accepting changes
- [ ] Add human-readable output with drift indicators
- [ ] Add JSON output format

### 3. Register command
- [ ] Add import in `src/index.ts`
- [ ] Register driftCommand

### 4. Write tests
- [ ] Create `tests/hasher.test.ts`
- [ ] Test JSON normalization
- [ ] Test hash consistency
- [ ] Test drift detection logic
- [ ] Test drift command with various scenarios

### 5. Verification
- [ ] Run full test suite
- [ ] Run typecheck
- [ ] Test manually with real tool
