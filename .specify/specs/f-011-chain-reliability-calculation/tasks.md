# F-011: Chain Reliability Calculation - Tasks

## Implementation Tasks

- [ ] Create `src/commands/chain-reliability.ts`
  - [ ] ChainReliabilityOptions interface
  - [ ] ChainReliabilityResult interface
  - [ ] calculateChainReliability function
  - [ ] chainReliabilityCommand with --all, --min flags
- [ ] Register command in `src/index.ts`
- [ ] Write tests in `tests/chain-reliability.test.ts`
  - [ ] Single tool (compound = own reliability)
  - [ ] Linear chain (A→B→C)
  - [ ] Diamond pattern (each dep counted once)
  - [ ] --all flag tests all tools
  - [ ] --min threshold pass/fail
  - [ ] Unknown tool error
  - [ ] JSON output format
- [ ] Run typecheck
- [ ] Run all tests
- [ ] Create docs.md
