# F-019: Debt Aggregation and Reporting - Documentation

## New Commands Added

### `pai-deps debt`

Shows technical debt aggregation across all tools.

**Options:**
- `-t, --type <type>` - Filter by tool type (cli, mcp, library, etc.)
- `-m, --min <score>` - Show only tools with debt >= score (default: 0)
- `--json` - Output as JSON

**Example:**
```bash
pai-deps debt
pai-deps debt --type cli
pai-deps debt --min 5
pai-deps --json debt
```

### `pai-deps report`

Generates comprehensive Markdown report about the tool ecosystem.

**Options:**
- `-o, --output <file>` - Write report to file instead of stdout
- `--json` - Output as JSON (includes report in `report` field)

**Report Sections:**
- System Overview (tool count, dependencies, graph stats)
- Tools by Type (count, debt, reliability)
- Debt Analysis (total debt, high debt tools, recommendations)
- Reliability Analysis (tools at risk, circular dependencies)
- Recent Verifications
- Tools never verified

**Example:**
```bash
pai-deps report
pai-deps report --output report.md
pai-deps --json report
```

## Files Changed

- `src/commands/debt.ts` - New file
- `src/commands/report.ts` - New file
- `src/index.ts` - Added command registrations
- `tests/blast-radius.test.ts` - Fixed pre-existing type error
