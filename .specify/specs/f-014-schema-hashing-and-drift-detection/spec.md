# Feature Specification: F-014 Schema Hashing and Drift Detection

## Problem Statement

Tools may declare output schemas in their manifests, but there's no way to detect when these schemas change. A tool's `--json` output format might change, breaking downstream consumers, and there's no automated way to detect this schema drift before it causes issues.

## Users & Stakeholders

**Primary User:** PAI developer maintaining tool contracts
**Use Case:** Detect when CLI output schemas change, catch breaking changes early

## Current State

- Contracts table has `schema_path` and `schema_hash` columns (unused)
- CLI verification (F-013) checks commands exist but not schema stability
- No mechanism to track schema changes over time
- No way to detect breaking changes in JSON output format

## Requirements

### Functional

1. **Schema hashing utility**:
   - Compute SHA256 hash of schema files (JSON Schema)
   - Compute hash of actual CLI `--json` output
   - Normalize JSON before hashing (sorted keys, no whitespace)

2. **Hash storage**:
   - Store schema hash in contracts table when registered
   - Update hash when `verify --update-hash` is run
   - Track history in verifications table

3. **drift command**: Check for schema changes
   - `pai-deps drift <tool>` - check single tool's contracts
   - `pai-deps drift --all` - check all tools with schemas
   - Exit code 0 if no drift, non-zero if drift detected

4. **Output format** (human-readable):
   ```
   Checking schema drift for: email

   ✓ email search     No drift (hash unchanged)
   ⚠ email stats      Drift detected
     - New fields: totalSent
     - Removed fields: none
     - Hash: abc123 → def456

   Results: 1 unchanged, 1 drifted
   ```

5. **JSON output**:
   ```json
   {
     "tool": "email",
     "results": [
       {
         "contract": "email search",
         "status": "unchanged",
         "storedHash": "abc123...",
         "currentHash": "abc123..."
       },
       {
         "contract": "email stats",
         "status": "drift",
         "storedHash": "abc123...",
         "currentHash": "def456...",
         "changes": {
           "added": ["totalSent"],
           "removed": []
         }
       }
     ],
     "summary": {
       "unchanged": 1,
       "drifted": 1,
       "total": 2
     }
   }
   ```

6. **Update hashes**:
   - `pai-deps drift --update` - Update stored hashes after review
   - Records change in verifications table with git commit

### Non-Functional

- Hashing should be deterministic (same input = same hash)
- Should work offline (no network calls required)
- Safe to run in CI environments

## Edge Cases & Error Handling

1. **No schema_path declared**: Skip contract (can't compute hash)
2. **Schema file missing**: Report as broken, not drift
3. **Tool not in PATH**: Can't compute output hash, use schema file only
4. **First run (no stored hash)**: Store initial hash, report as "new"

## Success Criteria

1. Can detect when JSON output schemas change
2. Clear reporting of what changed (fields added/removed)
3. `--update` allows accepting intentional changes
4. Works in CI with proper exit codes
