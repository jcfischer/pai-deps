# F-018: Blast Radius - Technical Plan

## Architecture

Extends the affected command pattern with additional analysis layers:

```
┌─────────────────────────────────────────────────────────┐
│                  blast-radius command                    │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Impact        │  │ Risk Score   │  │ Rollback     │ │
│  │ Collector     │  │ Calculator   │  │ Advisor      │ │
│  └───────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│          │                 │                  │         │
│          └─────────────────┴──────────────────┘         │
│                            │                            │
│               ┌────────────▼────────────┐               │
│               │    DependencyGraph      │               │
│               └─────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

## Implementation Approach

### 1. Reuse Affected Analysis

The `affected` command already calculates transitive dependents with depth. We'll reuse this for the base impact data.

### 2. Risk Score Formula

```typescript
interface RiskFactors {
  affectedCount: number;      // Number of affected tools
  avgDebtScore: number;       // Average debt score (0-100)
  chainReliability: number;   // 0.0-1.0
  criticalCount: number;      // Number of MCP tools affected
}

function calculateRiskScore(factors: RiskFactors): number {
  const baseScore = factors.affectedCount;
  const debtMultiplier = 1 + (factors.avgDebtScore / 10);
  const reliabilityPenalty = 1 / Math.max(factors.chainReliability, 0.1);
  const criticalBonus = factors.criticalCount * 5;

  return (baseScore * debtMultiplier * reliabilityPenalty) + criticalBonus;
}

// Risk levels:
// 0-20:   LOW
// 20-50:  MEDIUM
// 50-100: HIGH
// 100+:   CRITICAL
```

### 3. Impact Categorization

Group affected tools by:
1. **Dependency type**: cli, mcp, library, workflow, hook
2. **Severity level**: Critical (MCP), High (debt>5), Medium (CLI), Low (other)
3. **Depth from source**: 1 (direct), 2, 3, etc.

### 4. Rollback Strategy Generation

Based on dependency analysis, suggest:
- Testing order (MCP first, then direct CLI, then transitive)
- Feature flag consideration for large blast radius
- Backwards compatibility checks needed

## File Changes

### New Files
- `src/commands/blast-radius.ts` - Main command implementation
- `tests/blast-radius.test.ts` - Unit tests

### Modified Files
- `src/index.ts` - Register blast-radius command

## Dependencies

- Reuses `DependencyGraph` from `src/lib/graph/`
- Reuses chain reliability calculation from F-011
- Uses `formatTable` from `src/lib/table.ts`

## Testing Strategy

1. Empty blast radius (tool has no dependents)
2. Single depth blast radius
3. Multi-depth blast radius
4. Risk score calculation with various debt scores
5. MCP tools affecting critical classification
6. JSON output format
