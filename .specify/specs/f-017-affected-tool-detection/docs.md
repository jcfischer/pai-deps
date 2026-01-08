# F-017: Affected Tool Detection - Documentation

## Overview

The `affected` command shows all tools that would be affected by changes to a given tool. It traverses the reverse dependency graph to find all direct and transitive dependents.

## Usage

```bash
# Show all tools affected by changes (transitive by default)
pai-deps affected <tool>

# Show only directly affected tools
pai-deps affected <tool> --direct

# JSON output for CI integration
pai-deps affected <tool> --json
```

## Output

### Human-Readable

```
Tools affected by changes to: resona

ID               Name                 Type    Reliability  Depth
──────────────────────────────────────────────────────────────────
supertag-cli     Supertag CLI        cli     0.95         1
email            Email Tool          cli+mcp 0.90         1
ragent           Ragent              cli     0.95         2
daily-briefing   Daily Briefing      cli     0.85         3

Total: 4 affected tools (max depth: 3)
```

### JSON Output

```json
{
  "success": true,
  "tool": "resona",
  "direct": false,
  "affected": [
    { "id": "supertag-cli", "name": "Supertag CLI", "type": "cli", "reliability": 0.95, "depth": 1 },
    { "id": "email", "name": "Email Tool", "type": "cli+mcp", "reliability": 0.90, "depth": 1 },
    { "id": "ragent", "name": "Ragent", "type": "cli", "reliability": 0.95, "depth": 2 },
    { "id": "daily-briefing", "name": "Daily Briefing", "type": "cli", "reliability": 0.85, "depth": 3 }
  ],
  "count": 4,
  "maxDepth": 3
}
```

## Comparison with rdeps

| Aspect | `rdeps` | `affected` |
|--------|---------|------------|
| Default | Direct dependents only | Transitive dependents |
| Semantic | "What depends on me?" | "What breaks if I change?" |
| Flag | `--transitive` to expand | `--direct` to restrict |
| Use case | Exploring dependencies | CI impact analysis |

## Exit Codes

- `0`: Tool found (even if no affected tools)
- `1`: Tool not found or error

## Files

- `src/commands/affected.ts` - Command implementation
- `tests/affected.test.ts` - 7 tests covering graph scenarios
