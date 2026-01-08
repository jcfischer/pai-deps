# F-017: Affected Tool Detection - Tasks

## Implementation Tasks

- [ ] Create `src/commands/affected.ts`
  - [ ] AffectedOptions interface with direct flag
  - [ ] AffectedJsonOutput interface
  - [ ] affectedCommand function following rdeps pattern
  - [ ] Default to transitive, --direct for only immediate
- [ ] Register command in `src/cli.ts`
- [ ] Write tests in `tests/affected.test.ts`
  - [ ] Empty graph returns empty
  - [ ] Single tool with no dependents
  - [ ] Chain pattern (A→B→C)
  - [ ] Diamond pattern (A→B, A→C, B→D, C→D)
  - [ ] Direct flag restricts to immediate
  - [ ] Unknown tool returns error
  - [ ] JSON output format
- [ ] Run typecheck
- [ ] Run all tests
- [ ] Create docs.md
