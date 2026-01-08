# F-018: Blast Radius Calculation

## Overview

The `blast-radius` command provides detailed impact analysis when making changes to a tool, including risk assessment and rollback strategy suggestions.

## Usage

```bash
# Analyze blast radius for a tool
pai-deps blast-radius <tool>

# JSON output for automation
pai-deps --json blast-radius <tool>
```

## Output

### Human-Readable Format

```
Blast Radius Analysis: email
════════════════════════════════════════════════════════════════

Impact Summary:
  Directly affected:     3 tools
  Transitively affected: 7 tools
  Total blast radius:    10 tools
  Max depth:             3 hops

Risk Assessment:
  Risk Score:        47.3 (HIGH ⚠⚠)
  Chain Reliability: 81.5%
  Avg Debt Score:    3.2
  Critical Tools:    2 (MCP)

Impact by Type:
  Type     Count  Critical
  ─────────────────────────
  mcp      2      ⚠ Yes
  cli      6
  library  2

Impact by Depth:
  Depth 1:  3 tools (direct)
  Depth 2:  5 tools
  Depth 3:  2 tools

Rollback Strategy:
  1. Test affected MCP tools first (real-time integrations at risk)
  2. Verify 3 direct dependent(s) before deployment
  3. Extra attention on 1 high-debt tool(s): legacy-api
  4. Consider feature flag for gradual rollout
  5. Warning: Chain reliability is 81.5% - add error boundaries
  6. Test from innermost (depth 1) to outermost (depth 3)

Affected Tools:
  ID          Name        Type     Reliability  Debt  Depth
  ──────────────────────────────────────────────────────────
  api         API         cli      0.95         0     1
  tana-mcp    Tana MCP    mcp      0.90         2     1
  ...
```

### JSON Output

```json
{
  "success": true,
  "analysis": {
    "tool": "email",
    "impact": {
      "directCount": 3,
      "transitiveCount": 7,
      "totalCount": 10,
      "maxDepth": 3
    },
    "risk": {
      "score": 47.3,
      "level": "HIGH",
      "chainReliability": 0.815,
      "avgDebtScore": 3.2,
      "criticalCount": 2
    },
    "byType": [
      { "type": "mcp", "count": 2, "critical": true },
      { "type": "cli", "count": 6, "critical": false }
    ],
    "byDepth": [
      { "depth": 1, "count": 3 },
      { "depth": 2, "count": 5 }
    ],
    "affectedTools": [...],
    "rollbackStrategy": [...]
  }
}
```

## Risk Score Formula

```
Risk Score = (affected_count × debt_multiplier × reliability_penalty) + critical_bonus

Where:
- debt_multiplier = 1 + (avg_debt_score / 10)
- reliability_penalty = 1 / max(chain_reliability, 0.1)
- critical_bonus = critical_count × 5
```

### Risk Levels

| Score    | Level    | Indicator |
|----------|----------|-----------|
| 0-20     | LOW      |           |
| 20-50    | MEDIUM   | ⚠         |
| 50-100   | HIGH     | ⚠⚠        |
| 100+     | CRITICAL | 🔴        |

## Critical Tool Detection

MCP tools are automatically flagged as critical because:
- They provide real-time integrations
- Failures affect user experience immediately
- No automatic retry unlike CLI tools

## Testing

9 tests cover:
- Empty blast radius (isolated tools)
- Single-depth blast radius
- Multi-depth blast radius
- Risk score calculation with various factors
- Critical MCP tool identification
- Rollback strategy generation
- JSON output format validation
