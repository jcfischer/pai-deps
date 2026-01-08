# F-020: Health Dashboard - Implementation Tasks

## Tasks

### 1. Create health command structure
- [ ] Create `src/commands/health.ts`
- [ ] Define interfaces: `HealthMetrics`, `HealthIssue`, `HealthJsonOutput`
- [ ] Register command in `src/index.ts`
- [ ] Add options: `--compact`, `--no-color`

### 2. Implement data collection
- [ ] Query tool count (non-stub)
- [ ] Query dependency count
- [ ] Calculate total debt
- [ ] Calculate average reliability
- [ ] Count verified vs unverified tools
- [ ] Load DependencyGraph and find cycles
- [ ] Calculate compound reliability, find at-risk tools

### 3. Implement status determination
- [ ] Define status thresholds (OK/WARNING/CRITICAL)
- [ ] Collect issues list with descriptions
- [ ] Determine overall health status

### 4. Implement ASCII dashboard rendering
- [ ] Create box-drawing helper for dashboard frame
- [ ] Render header with title
- [ ] Render metrics row (tools, deps, debt, reliability)
- [ ] Render status bars with indicators
- [ ] Render issues section

### 5. Implement output modes
- [ ] Full dashboard (default)
- [ ] Compact single-line mode (`--compact`)
- [ ] JSON output (via global `--json`)
- [ ] Color support with `--no-color` override

### 6. Verification
- [ ] Build passes (`bun run build`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] Manual testing of all output modes
- [ ] Verify exit codes (0 for OK, 1 for issues)
