# F-011: Chain Reliability Calculation

## Problem Statement

When tools depend on chains of other tools, the compound reliability degrades multiplicatively. A chain of 5 tools each at 95% reliability yields only 77.4% compound reliability. Developers need visibility into these compound risks to make informed decisions.

## Users & Stakeholders

- **Primary**: Developers assessing tool reliability
- **Secondary**: SpecKit/SpecFlow integration for risk warnings

## Requirements

### Functional

1. `pai-deps chain-reliability <tool>` calculates compound reliability
2. Shows all dependency chains and their compound reliabilities
3. Identifies the weakest chain (lowest compound reliability)
4. Support `--all` flag to check all registered tools
5. Support `--min <threshold>` to warn/fail if below threshold
6. Support `--json` output for CI integration
7. Exit code 0 if above threshold, 1 if below or error

### Non-Functional

- Traverses dependency graph to find all paths
- Reliability = product of all tool reliabilities in chain
- Default warning threshold: 80%

## Success Criteria

1. Correctly calculates compound reliability for linear chains
2. Handles diamond dependencies (don't double-count)
3. JSON output includes all chains with their reliabilities
4. `--min 0.8` fails when compound < 80%

## Scope

### In Scope

- New `chain-reliability` command
- Calculation of compound reliability
- Threshold checking
- Integration-ready JSON output

### Explicitly Out of Scope

- Blast radius calculation (F-018)
- Reliability history/trends
- Automatic reliability scoring
