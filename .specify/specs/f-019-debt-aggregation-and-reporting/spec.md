# F-019: Debt Aggregation and Reporting

## Problem Statement

Developers need visibility into technical debt across their tool ecosystem. Currently debt scores exist per-tool but there's no way to:
- View aggregate debt by type or category
- Generate reports for stakeholder communication
- Identify where to focus remediation efforts

## Requirements

### Functional Requirements

1. **Debt Command**: `pai-deps debt`
   - Show total debt score across all tools
   - Group by tool type (cli, mcp, library, etc.)
   - Sort tools by debt score (highest first)
   - Filter by type with `--type` flag
   - Show only tools above threshold with `--min` flag

2. **Report Command**: `pai-deps report`
   - Generate comprehensive Markdown report
   - Include system overview (tool count, total deps)
   - Include debt summary with recommendations
   - Include reliability analysis (chain reliability)
   - Include recent verification history
   - Output to file with `--output` flag

### Non-Functional Requirements
- JSON output support for both commands
- Human-readable ASCII tables for debt
- Valid Markdown output for reports

## User Experience

### Debt Command

```bash
$ pai-deps debt

Technical Debt Summary
═══════════════════════════════════════════════════════

Total Debt Score: 127

By Type:
  Type     Tools  Total Debt  Avg Debt
  ─────────────────────────────────────
  cli      12     85          7.1
  mcp      5      32          6.4
  library  3      10          3.3

High Debt Tools (debt > 10):
  ID            Type  Debt Score  Issues
  ──────────────────────────────────────────────
  legacy-api    cli   25          Missing tests, outdated deps
  old-parser    lib   15          No documentation
  ...

$ pai-deps debt --type cli
$ pai-deps debt --min 5
$ pai-deps --json debt
```

### Report Command

```bash
$ pai-deps report --output report.md

Generated: report.md

$ pai-deps report  # outputs to stdout
```

Generated report includes:
- System Overview
- Dependency Graph Summary
- Debt Analysis
- Reliability Analysis
- Verification History
- Recommendations

## Success Criteria

- [x] debt command with type grouping
- [x] debt command with filtering options
- [x] report command with Markdown output
- [x] report includes all sections
- [x] JSON output for scripting
- [x] Tests cover aggregation logic

## Out of Scope

- Graphical reports (charts/images)
- Automatic debt remediation
- Integration with external issue trackers
