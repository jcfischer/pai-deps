# F-021: SpecKit Integration

## Overview

Provide CLI commands that SpecKit can call during its SPECIFY and PLAN phases to automatically populate system context and failure mode analysis based on the dependency graph.

## User Stories

### US-1: System Context During SPECIFY
As a developer using SpecKit's SPECIFY phase, I want `pai-deps` to automatically provide upstream/downstream dependencies so I don't have to manually list them in my spec.

### US-2: Failure Modes During PLAN
As a developer using SpecKit's PLAN phase, I want `pai-deps` to generate potential failure modes based on the dependency chain so I can design proper error handling.

## Requirements

### FR-1: speckit context Command
```bash
pai-deps speckit context <tool> [--json]
```

**Output includes:**
- Upstream dependencies (what this tool depends on)
- Downstream consumers (what depends on this tool)
- Compound reliability of the tool's dependency chain
- Blast radius (how many tools affected if this breaks)
- Cycle warnings (if tool is part of circular dependency)

**JSON format:**
```json
{
  "tool": "daily-briefing",
  "upstream": [
    { "id": "email", "type": "cli", "reliability": 0.95 },
    { "id": "ical", "type": "cli", "reliability": 0.95 }
  ],
  "downstream": [],
  "compoundReliability": 0.774,
  "blastRadius": 0,
  "cycles": [],
  "warnings": ["Chain reliability below 80%"]
}
```

### FR-2: speckit failures Command
```bash
pai-deps speckit failures <tool> [--json]
```

**Generates failure modes for each upstream dependency:**
- Failure mode description
- Detection mechanism
- Suggested recovery strategy
- Impact severity (based on blast radius)

**JSON format:**
```json
{
  "tool": "daily-briefing",
  "failureModes": [
    {
      "dependency": "email",
      "mode": "email service unavailable",
      "detection": "CLI returns non-zero exit code or timeout",
      "recovery": "Skip email section, log warning, continue with other data",
      "severity": "medium",
      "affectedDownstream": 0
    },
    {
      "dependency": "ical",
      "mode": "calendar API rate limited",
      "detection": "429 status in error output",
      "recovery": "Use cached calendar data if available, warn user",
      "severity": "medium",
      "affectedDownstream": 0
    }
  ]
}
```

### FR-3: Human-Readable Output
Both commands support ASCII table output (default) in addition to `--json`.

**Example `speckit context` output:**
```
System Context: daily-briefing
══════════════════════════════════════════════════════════════

Upstream Dependencies (5):
  email       cli      0.95 reliability
  ical        cli      0.95 reliability
  supertag    cli      0.95 reliability
  ragent      cli      0.95 reliability
  resona      library  0.95 reliability

Downstream Consumers: none

Compound Reliability: 77.4% [WARNING: below 80%]
Blast Radius: 0 tools affected

Cycles: none
```

**Example `speckit failures` output:**
```
Failure Mode Analysis: daily-briefing
══════════════════════════════════════════════════════════════

[1] email unavailable
    Detection: CLI returns non-zero exit code or timeout
    Recovery:  Skip email section, continue with partial data
    Severity:  MEDIUM (0 downstream affected)

[2] ical API unavailable
    Detection: CLI returns non-zero exit code or timeout
    Recovery:  Use cached calendar data if available
    Severity:  MEDIUM (0 downstream affected)
...
```

## Non-Functional Requirements

### NFR-1: Performance
Commands must complete in < 500ms for tools with up to 50 dependencies.

### NFR-2: Cacheability
Output is deterministic given the same database state, allowing SpecKit to cache results.

## Exit Codes
- `0` - Success
- `1` - Tool not found
- `2` - Database error

## Integration Point

SpecKit will call these commands during:
- **SPECIFY phase**: `pai-deps speckit context <tool> --json` to populate system context section
- **PLAN phase**: `pai-deps speckit failures <tool> --json` to seed failure mode analysis
