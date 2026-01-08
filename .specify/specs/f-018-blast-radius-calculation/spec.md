# F-018: Blast Radius Calculation

## Problem Statement

When making changes to a tool, developers need to understand the full impact of those changes beyond just knowing which tools are affected. They need:
- A quantified risk assessment
- Understanding of impact severity by dependency type
- Actionable rollback strategies

The `affected` command shows what's affected, but doesn't assess risk or provide guidance.

## Requirements

### Functional Requirements

1. **Blast Radius Command**: `pai-deps blast-radius <tool>`
   - Count all directly and transitively affected tools
   - Group impacts by dependency type (cli, mcp, library, etc.)
   - Show depth distribution (how many at each hop)

2. **Risk Score Calculation**
   - Base score: Number of affected tools
   - Multipliers: Average debt score of affected tools
   - Reliability factor: Chain reliability to furthest affected tool
   - Formula: `risk = affected_count * (1 + avg_debt/10) * (1 / chain_reliability)`

3. **Impact Categorization**
   - Critical: MCP tools affected (real-time integrations)
   - High: CLI tools with debt > 5 affected
   - Medium: CLI tools affected
   - Low: Stub/library tools affected

4. **Rollback Strategy Suggestions**
   - Based on dependency types in blast radius
   - Consider whether changes are backwards compatible
   - Suggest testing order (innermost to outermost)

### Non-Functional Requirements
- Reuse DependencyGraph from affected command
- JSON output for automation
- Human-readable ASCII output

## User Experience

```bash
$ pai-deps blast-radius email

Blast Radius Analysis: email
═══════════════════════════════════════════════════════════════

Impact Summary:
  Directly affected:    3 tools
  Transitively affected: 7 tools
  Total blast radius:   10 tools
  Max depth:            3 hops

Risk Assessment:
  Risk Score:    47.3 (HIGH)
  Chain Reliability: 81.5%
  Avg Debt Score: 3.2

Impact by Type:
  Type     Count  Critical
  ─────────────────────────
  mcp      4      ⚠ Yes
  cli      5
  library  1

Impact by Depth:
  Depth 1:  3 tools (direct)
  Depth 2:  5 tools
  Depth 3:  2 tools

Rollback Strategy:
  1. Test affected MCP tools first (real-time impact)
  2. Verify CLI tools at depth 1
  3. Run integration tests for downstream consumers
  4. Consider feature flag for gradual rollout

Affected Tools:
  [Table of affected tools with risk indicators]
```

## Success Criteria

- [x] blast-radius command implemented
- [x] Risk score calculation working
- [x] Impact categorization by type and severity
- [x] Rollback strategy suggestions generated
- [x] JSON output for scripting
- [x] Tests cover risk calculation scenarios

## Out of Scope

- Automatic rollback execution
- Integration with actual git rollback
- File-level impact analysis
