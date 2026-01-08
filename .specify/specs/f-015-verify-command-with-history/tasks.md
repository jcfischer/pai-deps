# F-015: Verify Command with History - Tasks

## Implementation Tasks

- [ ] Add `toolVerifications` table to `src/db/schema.ts`
- [ ] Export new table from `src/db/index.ts`
- [ ] Modify `src/commands/verify.ts` to store results
  - [ ] Get current git commit (handle non-git dirs)
  - [ ] Insert into toolVerifications after verification
  - [ ] Update tools.lastVerified
- [ ] Create `src/commands/verify-history.ts`
  - [ ] VerifyHistoryOptions interface
  - [ ] Query toolVerifications with pagination
  - [ ] Format output table with timestamps
  - [ ] Support --limit flag
  - [ ] Support --json output
- [ ] Register verify-history command in `src/index.ts`
- [ ] Update `src/commands/show.ts` to display lastVerified
- [ ] Write tests in `tests/verify-history.test.ts`
  - [ ] Verify stores result
  - [ ] History query returns results
  - [ ] Git commit captured
  - [ ] Limit flag works
- [ ] Run typecheck
- [ ] Run all tests
- [ ] Create docs.md
