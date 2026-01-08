# F-011: Chain Reliability Calculation - Technical Plan

## Overview

Add a command to calculate compound reliability for dependency chains. The reliability of a chain is the product of all individual tool reliabilities.

## Architecture

### Algorithm

For a tool T with dependencies, calculate:
1. Find all transitive dependencies using existing `getTransitiveDependencies()`
2. Include T's own reliability in the calculation
3. Calculate compound = T.reliability × dep1.reliability × dep2.reliability × ...
4. Report the compound reliability and chain length

### Design Decision: Chain vs Tree

Two approaches for calculating compound reliability:

**Option A: Longest Path**
- Find the longest dependency path
- Multiply reliabilities along that path only
- Pro: Simple, matches "critical path" thinking
- Con: Ignores parallel dependencies

**Option B: All Dependencies (Selected)**
- Include ALL transitive dependencies
- Each tool contributes once (no double-counting in diamonds)
- Pro: Reflects actual system risk
- Con: May be overly pessimistic

We'll use Option B as it better reflects system reliability - any dependency failure affects the tool.

### Formula

```
compound_reliability = tool.reliability × Π(dep.reliability for dep in transitive_deps)
```

## Implementation

```typescript
// src/commands/chain-reliability.ts
interface ChainReliabilityOptions {
  all?: boolean;
  min?: string;  // threshold like "0.8"
}

// Calculate for single tool
function calculateChainReliability(
  graph: DependencyGraph,
  toolId: string
): { compound: number; chain: string[]; length: number }

// Register command
pai-deps chain-reliability <tool>
pai-deps chain-reliability --all
pai-deps chain-reliability --all --min 0.8
```

## Testing

1. Single tool (no deps) - compound = tool's reliability
2. Linear chain A→B→C - compound = A × B × C
3. Diamond A→B, A→C, B→D, C→D - each counts once
4. --min threshold check
5. Unknown tool error
