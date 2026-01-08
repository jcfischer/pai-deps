# F-021: SpecKit Integration - Documentation

## New Commands

### `pai-deps speckit context <tool>`

Displays system context for a tool - used by SpecKit's SPECIFY phase.

**Output includes:**
- Upstream dependencies (transitive)
- Downstream consumers (transitive)
- Compound reliability
- Blast radius
- Circular dependency warnings
- Health warnings

**Options:**
- `--json` - JSON output (via global flag)

**Exit Codes:**
- `0` - Success
- `1` - Tool not found or error

**Example:**
```bash
# ASCII output
pai-deps speckit context daily-briefing

# JSON for SpecKit integration
pai-deps --json speckit context daily-briefing
```

**Sample Output:**
```
System Context: daily-briefing
════════════════════════════════════════════════════════════

Upstream Dependencies (4):
ID        Type     Reliability
──────────────────────────────
email     library  95%
calendar  cli      95%
ical      cli      95%
resona    library  95%

Downstream Consumers (0):
  (none)

Compound Reliability: 77.4% [WARNING: below 80%]
Blast Radius: 0 tools affected

Cycles: none

Warnings:
  ⚠ Chain reliability below 80% (77.4%)
```

---

### `pai-deps speckit failures <tool>`

Generates failure mode analysis for a tool - used by SpecKit's PLAN phase.

**For each upstream dependency, generates:**
- Failure mode description
- Detection mechanism
- Recovery strategy
- Severity (based on downstream impact)

**Options:**
- `--json` - JSON output (via global flag)

**Exit Codes:**
- `0` - Success
- `1` - Tool not found or error

**Example:**
```bash
# ASCII output
pai-deps speckit failures daily-briefing

# JSON for SpecKit integration
pai-deps --json speckit failures daily-briefing
```

**Sample Output:**
```
Failure Mode Analysis: daily-briefing
════════════════════════════════════════════════════════════

[1] calendar CLI unavailable
    Type:      cli
    Detection: CLI returns non-zero exit code or timeout
    Recovery:  Skip calendar data, continue with partial output
    Severity:  CRITICAL (7 downstream affected)

[2] email library throws exception
    Type:      library
    Detection: Catch block triggered on import or function call
    Recovery:  Log error, degrade gracefully
    Severity:  CRITICAL (11 downstream affected)
...
```

---

## Severity Levels

| Severity | Downstream Impact |
|----------|-------------------|
| critical | >5 tools affected |
| high | 3-5 tools affected |
| medium | 1-2 tools affected |
| low | 0 tools affected |

## Failure Mode Templates

Templates are applied based on dependency type:

| Type | Mode | Detection | Recovery |
|------|------|-----------|----------|
| cli | {name} CLI unavailable | CLI returns non-zero exit code or timeout | Skip {name} data, continue with partial output |
| mcp | {name} MCP server unavailable | MCP tool call returns error or connection refused | Fall back to CLI interface if available |
| library | {name} library throws exception | Catch block triggered on import or function call | Log error, degrade gracefully |
| database | {name} database unavailable | Connection timeout or query error | Use cached data if available, retry with backoff |
| npm | {name} npm package incompatible | Runtime type error or missing export | Pin to known-good version, add fallback |

## Files Changed

- `src/commands/speckit.ts` - New command (380 lines)
- `src/index.ts` - Added command registration
