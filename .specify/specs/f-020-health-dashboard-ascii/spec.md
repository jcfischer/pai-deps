# F-020: Health Dashboard (ASCII)

## Problem Statement

Developers need a quick way to assess overall system health without running multiple commands. Currently getting a complete picture requires running `debt`, `chain-reliability --all`, `list`, and checking for cycles separately.

## Requirements

### Functional Requirements

1. **Health Command**: `pai-deps health`
   - Single-screen ASCII dashboard showing system health
   - Summary metrics at top (tools, deps, debt, avg reliability)
   - Health indicators with color coding (via ANSI or symbols)
   - Issues section highlighting problems needing attention
   - Quick to scan - designed for terminal width (~80 chars)

2. **Sections to Include**:
   - **Overview**: Tool count, dependency count, graph connectivity
   - **Debt Status**: Total debt, high-debt tool count, debt trend indicator
   - **Reliability**: Average reliability, tools below threshold, at-risk chains
   - **Verification**: Last verified, tools never verified, recent failures
   - **Issues**: Cycles detected, broken contracts, missing dependencies

3. **Options**:
   - `--no-color` - Disable ANSI colors for piping
   - `--compact` - Single-line summary for scripting/status bars

### Non-Functional Requirements
- Fast execution (< 500ms for typical registry)
- Works in 80-column terminals
- JSON output support via global `--json` flag
- No external dependencies for rendering

## User Experience

```bash
$ pai-deps health

╔══════════════════════════════════════════════════════════════════════════════╗
║                           PAI DEPENDENCY HEALTH                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Tools: 34        Dependencies: 29        Debt: 5         Reliability: 94.8% ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  DEBT          ████░░░░░░  5 pts    [OK] Low debt                           ║
║  RELIABILITY   █████████░  94.8%    [OK] Above threshold                    ║
║  VERIFIED      ██░░░░░░░░  3/34     [!!] 31 tools never verified            ║
║  CYCLES        ░░░░░░░░░░  4        [!!] Self-referential cycles detected   ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  ISSUES (2)                                                                  ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  ⚠ 4 circular dependencies detected                                         ║
║  ⚠ daily-briefing: compound reliability 77.4% (below 80% threshold)         ║
╚══════════════════════════════════════════════════════════════════════════════╝

$ pai-deps health --compact
OK tools:34 deps:29 debt:5 rel:94.8% issues:2

$ pai-deps --json health
{
  "success": true,
  "health": {
    "tools": 34,
    "dependencies": 29,
    "totalDebt": 5,
    "avgReliability": 0.948,
    "verified": 3,
    "cycles": 4,
    "issues": [...]
  },
  "status": "WARNING"
}
```

## Success Criteria

- [ ] health command displays ASCII dashboard
- [ ] All key metrics visible in single screen
- [ ] Issues section highlights actionable problems
- [ ] --compact mode for single-line output
- [ ] --no-color mode for piping
- [ ] JSON output via --json flag
- [ ] Executes in < 500ms

## Out of Scope

- Real-time updating/watch mode
- Historical trend graphs
- Integration with monitoring systems
- Custom threshold configuration (use defaults)
