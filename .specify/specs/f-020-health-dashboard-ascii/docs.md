# F-020: Health Dashboard - Documentation

## New Command

### `pai-deps health`

Displays a single-screen ASCII dashboard showing overall system health.

**Options:**
- `-c, --compact` - Single-line output for scripting/status bars
- `--no-color` - Disable ANSI color codes (also respects NO_COLOR env var)
- `--json` - JSON output (via global flag)

**Exit Codes:**
- `0` - System healthy (OK status)
- `1` - Issues detected (WARNING or CRITICAL status)

**Example:**
```bash
# Full dashboard
pai-deps health

# Compact for scripting
pai-deps health --compact
# Output: OK tools:34 deps:29 debt:5 rel:94.8% issues:0

# JSON for automation
pai-deps --json health

# No colors for piping
pai-deps health --no-color | tee health.txt
```

**Dashboard Sections:**
- Header with overall status (OK/WARNING/CRITICAL)
- Metrics row (tools, deps, debt, reliability)
- Status bars with indicators for debt, reliability, verification, cycles
- Issues section listing actionable problems

**Status Determination:**
- CRITICAL: >2 cycles OR >3 tools with compound reliability <80%
- WARNING: Any cycles OR any tool below reliability threshold OR high debt
- OK: No issues detected

## Files Changed

- `src/commands/health.ts` - New command (350 lines)
- `src/index.ts` - Added command registration
