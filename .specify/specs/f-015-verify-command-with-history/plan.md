# F-015: Verify Command with History - Technical Plan

## Overview

Extend the verify command to persist results and add a history command to query past verifications.

## Architecture

### Data Flow

```
verify <tool>
    │
    ├─► Run CLI/MCP verification (existing)
    │
    ├─► Store result in verifications table
    │       - toolId, status, details, gitCommit, verifiedAt
    │
    └─► Update tools.lastVerified timestamp
```

### Database Changes

The schema already has:
- `verifications` table with contractId, verifiedAt, status, details, gitCommit
- `tools.lastVerified` timestamp

We'll store tool-level verifications (not contract-level for simplicity).

### New Table: tool_verifications

Since the existing `verifications` table is contract-focused, we'll add a simpler tool-level table:

```sql
CREATE TABLE tool_verifications (
  id INTEGER PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tools(id),
  verified_at TEXT NOT NULL,
  cli_status TEXT,  -- pass | fail | skipped
  cli_passed INTEGER,
  cli_failed INTEGER,
  mcp_status TEXT,  -- pass | fail | skipped
  mcp_found INTEGER,
  mcp_missing INTEGER,
  git_commit TEXT,
  duration_ms INTEGER
);
```

## Implementation

### 1. Add tool_verifications table

Add to schema.ts and create migration.

### 2. Modify verify command

After verification:
```typescript
// Get current git commit
const gitCommit = execSync('git rev-parse HEAD').toString().trim();

// Store verification result
db.insert(toolVerifications).values({
  toolId: tool.id,
  verifiedAt: new Date().toISOString(),
  cliStatus: cliResult.summary.failed > 0 ? 'fail' : 'pass',
  cliPassed: cliResult.summary.passed,
  cliFailed: cliResult.summary.failed,
  mcpStatus: mcpResult?.summary.missing > 0 ? 'fail' : 'pass',
  // ...
});

// Update tools.lastVerified
db.update(tools).set({ lastVerified: now }).where(eq(tools.id, tool.id));
```

### 3. Add verify-history command

```typescript
pai-deps verify-history <tool>
pai-deps verify-history <tool> --limit 10
pai-deps verify-history --all --since 7d
```

## Testing

1. Verify stores result in database
2. verify-history shows stored results
3. Git commit captured when in git repo
4. show command includes lastVerified
