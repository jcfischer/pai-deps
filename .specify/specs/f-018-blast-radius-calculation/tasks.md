# F-018: Blast Radius - Implementation Tasks

## Tasks

### 1. Create blast-radius command skeleton
- [ ] Create `src/commands/blast-radius.ts`
- [ ] Define interfaces for options, impact data, JSON output
- [ ] Register command in `src/index.ts`
- [ ] Implement basic structure with error handling

### 2. Implement impact collection
- [ ] Reuse affected analysis with depth from DependencyGraph
- [ ] Group affected tools by type
- [ ] Group affected tools by depth
- [ ] Calculate depth distribution stats

### 3. Implement risk score calculation
- [ ] Calculate average debt score of affected tools
- [ ] Calculate chain reliability to max depth
- [ ] Implement risk score formula
- [ ] Classify risk level (LOW/MEDIUM/HIGH/CRITICAL)

### 4. Implement impact categorization
- [ ] Identify critical impacts (MCP tools)
- [ ] Identify high impacts (high debt tools)
- [ ] Generate severity summary

### 5. Implement rollback strategy generation
- [ ] Generate testing order recommendations
- [ ] Suggest feature flag for large blast radius
- [ ] Provide backwards compatibility guidance

### 6. Implement output formatting
- [ ] Human-readable ASCII output with sections
- [ ] JSON output with all analysis data
- [ ] Affected tools table with risk indicators

### 7. Write tests
- [ ] Test empty blast radius
- [ ] Test single-depth blast radius
- [ ] Test multi-depth blast radius
- [ ] Test risk score calculation
- [ ] Test critical tool detection
- [ ] Test JSON output format

### 8. Documentation
- [ ] Create docs.md with usage examples
