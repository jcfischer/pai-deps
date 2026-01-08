# F-011: Chain Reliability Calculation - Documentation

## Overview

The `chain-reliability` command calculates compound reliability for dependency chains. When tools depend on other tools, the overall reliability is the product of all individual reliabilities - a chain of 5 tools at 95% each yields only 77.4% compound reliability.

## Usage

```bash
# Calculate for a single tool
pai-deps chain-reliability <tool>

# Calculate for all tools
pai-deps chain-reliability --all

# Set minimum threshold (default: 0.8)
pai-deps chain-reliability --all --min 0.7

# JSON output for CI
pai-deps chain-reliability --all --json
```

## Output

### Human-Readable

```
Chain Reliability Analysis (threshold: 80.0%)

ID               Name              Own     Compound   Chain Length
──────────────────────────────────────────────────────────────────
daily-briefing   Daily Briefing    95.0%   77.4%      5
ragent           Ragent            95.0%   85.7%      3
email            Email Tool        90.0%   90.0%      1

All tools above 80.0% threshold.
```

### Single Tool Output

```
Chain Reliability for: daily-briefing

ID               Name              Own     Compound   Chain Length
──────────────────────────────────────────────────────────────────
daily-briefing   Daily Briefing    95.0%   77.4%      5

Chain: daily-briefing → ical → tana → email → ragent → resona
```

### JSON Output

```json
{
  "success": true,
  "results": [
    {
      "id": "daily-briefing",
      "name": "Daily Briefing",
      "reliability": 0.95,
      "compound": 0.7738,
      "chainLength": 5,
      "chain": ["daily-briefing", "ical", "tana", "email", "ragent", "resona"]
    }
  ],
  "threshold": 0.8,
  "belowThreshold": [
    {
      "id": "daily-briefing",
      "compound": 0.7738
    }
  ]
}
```

## Formula

```
compound_reliability = tool.reliability × Π(dep.reliability for dep in transitive_deps)
```

Example: 5 tools at 95%
```
0.95 × 0.95 × 0.95 × 0.95 × 0.95 = 0.7738 (77.4%)
```

## Exit Codes

- `0`: All tools above threshold
- `1`: One or more tools below threshold, or error

## CI Integration

```yaml
- name: Check chain reliability
  run: pai-deps chain-reliability --all --min 0.8 --json
```

## Files

- `src/commands/chain-reliability.ts` - Command implementation
- `tests/chain-reliability.test.ts` - 6 tests covering various chain patterns
