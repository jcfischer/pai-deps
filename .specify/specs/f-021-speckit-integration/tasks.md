# F-021: SpecKit Integration - Implementation Tasks

## Tasks

### 1. Create speckit command structure
- [ ] Create `src/commands/speckit.ts`
- [ ] Define interfaces: `ContextOutput`, `FailureModeOutput`, `FailureMode`
- [ ] Set up command group with `context` and `failures` subcommands
- [ ] Register in `src/index.ts`

### 2. Implement context subcommand
- [ ] Load DependencyGraph from database
- [ ] Get upstream dependencies (transitive)
- [ ] Get downstream consumers (transitive rdeps)
- [ ] Calculate compound reliability using existing logic
- [ ] Calculate blast radius using existing logic
- [ ] Find cycles involving this tool
- [ ] Generate warnings (low reliability, cycles, stubs)
- [ ] Render ASCII output (default)
- [ ] Render JSON output (`--json`)

### 3. Implement failures subcommand
- [ ] Define failure mode templates per dependency type
- [ ] Generate failure modes for each upstream dependency
- [ ] Calculate severity based on downstream count
- [ ] Render ASCII output (default)
- [ ] Render JSON output (`--json`)

### 4. Verification
- [ ] Build passes (`bun run build`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] Manual test: `pai-deps speckit context daily-briefing`
- [ ] Manual test: `pai-deps speckit context email --json`
- [ ] Manual test: `pai-deps speckit failures daily-briefing`
- [ ] Manual test: `pai-deps speckit failures email --json`
- [ ] Verify exit codes (0 success, 1 tool not found)

### 5. Documentation
- [ ] Create docs.md with command reference
