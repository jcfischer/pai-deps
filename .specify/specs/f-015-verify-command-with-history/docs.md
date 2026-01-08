# F-015: Verify Command with History

## Overview

The verify command now stores verification results to a history table, enabling tracking of verification trends over time and comparison across git commits.

## Features

### Verification History Storage

When running `pai-deps verify <tool>`, results are automatically saved to the `tool_verifications` table including:
- CLI verification status (passed/failed/skipped counts)
- MCP verification status (found/missing/extra counts)
- Overall pass/fail status
- Git commit hash at time of verification
- Timestamp

Use `--no-save` flag to skip storing results (useful for quick checks).

### Verify History Command

Query verification history with:

```bash
# Show verification history for a tool
pai-deps verify-history <tool>

# Limit number of records
pai-deps verify-history <tool> --limit 5

# JSON output
pai-deps verify-history <tool> --json
```

### Output Format

Human-readable output shows:
```
Verification history for: email (Email CLI)

Date        Status   CLI        MCP        Commit
01-08 14:30 ✓ pass   5✓ 0✗      3✓ 0✗      abc1234
01-07 10:15 ✗ fail   4✓ 1✗      2✓ 1✗      def5678
...

Showing 20 most recent verifications.
Last verified: 2026-01-08T14:30:00Z
```

JSON output includes all fields for scripting:
```json
{
  "success": true,
  "tool": "email",
  "history": [
    {
      "id": 1,
      "verifiedAt": "2026-01-08T14:30:00Z",
      "overallStatus": "pass",
      "cliStatus": "pass",
      "cliPassed": 5,
      "cliFailed": 0,
      "mcpStatus": "pass",
      "mcpFound": 3,
      "mcpMissing": 0,
      "gitCommit": "abc1234"
    }
  ],
  "count": 1
}
```

## Database Schema

New `tool_verifications` table:
- `id` - Auto-incrementing primary key
- `tool_id` - Foreign key to tools table
- `verified_at` - ISO timestamp
- `cli_status` - pass/fail/null
- `cli_passed`, `cli_failed`, `cli_skipped` - Integer counts
- `mcp_status` - pass/fail/null
- `mcp_found`, `mcp_missing`, `mcp_extra` - Integer counts
- `overall_status` - pass/fail (required)
- `git_commit` - Short commit hash
- `duration_ms` - Optional verification duration

Tools table updated with `last_verified` timestamp after each verification.

## Testing

5 tests cover:
- Insert verification record
- Store multiple verification records
- Query with limit
- Store MCP verification results
- Update lastVerified on tools table
