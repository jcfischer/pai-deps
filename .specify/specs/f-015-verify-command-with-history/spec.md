# F-015: Verify Command with History

## Problem Statement

Currently, verification results are ephemeral - they're displayed and forgotten. We need to:
1. Store verification results for tracking over time
2. Know when tools were last verified
3. Query verification history to identify patterns (flaky tools, recurring failures)

## Users & Stakeholders

- **Primary**: Developers tracking tool health over time
- **Secondary**: CI systems needing verification status

## Requirements

### Functional

1. Store verification results in `verifications` table after each run
2. Update `lastVerified` timestamp on tools table
3. Record git commit hash with each verification
4. Add `pai-deps verify-history <tool>` command to show verification history
5. Add `--save` flag to verify command (default: true) to persist results
6. Show last verification time in `pai-deps show <tool>` output

### Non-Functional

- Efficiently store only summary, not full output
- Keep reasonable history (e.g., last 100 verifications per tool)

## Success Criteria

1. After `pai-deps verify email`, database contains verification record
2. `pai-deps verify-history email` shows past verification results
3. `pai-deps show email` includes last verification timestamp
4. Git commit hash captured when available

## Scope

### In Scope

- Persisting verification results
- History query command
- Git commit capture

### Explicitly Out of Scope

- Verification scheduling/automation
- Notifications/alerts on failures
- Trend analysis/graphs
