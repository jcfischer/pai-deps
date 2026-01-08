# Feature Specification: F-013 CLI Contract Verification

## Problem Statement

Tools declare CLI commands they provide in their manifest, but there's no way to verify these declarations match the actual CLI implementation. A tool might claim to provide `email send` but the command might not exist, have different options, or have changed since the manifest was written.

## Users & Stakeholders

**Primary User:** PAI developer maintaining tool contracts
**Use Case:** Verify CLI declarations match reality, catch drift early

## Current State

- Manifests declare `provides.cli` with command names and optional schemas
- No verification that declared commands actually exist
- No way to detect when CLI interfaces change

## Requirements

### Functional

1. **verify command**: Check CLI contracts against actual implementations
   - `pai-deps verify <tool>` - verify single tool's CLI contracts
   - `pai-deps verify --all` - verify all registered tools
   - Exit code 0 if all pass, non-zero if any fail

2. **CLI verification checks**:
   - Command exists: Run `<tool> <command> --help` and check exit code
   - Required options present: Parse --help output for declared options
   - Return structured results per command

3. **Output format** (human-readable):
   ```
   Verifying CLI contracts for: email

   ✓ email search     Command exists, options match
   ✓ email send       Command exists, options match
   ✗ email delete     Command not found (exit code 127)

   Results: 2 passed, 1 failed
   ```

4. **JSON output**:
   ```json
   {
     "tool": "email",
     "results": [
       {
         "command": "email search",
         "status": "pass",
         "checks": {
           "exists": true,
           "helpAvailable": true
         }
       },
       {
         "command": "email delete",
         "status": "fail",
         "error": "Command not found",
         "checks": {
           "exists": false
         }
       }
     ],
     "summary": {
       "passed": 2,
       "failed": 1,
       "total": 3
     }
   }
   ```

5. **Verification levels**:
   - `--quick`: Only check command exists (fast)
   - Default: Check exists + help available
   - `--strict`: Also verify declared options appear in help

### Non-Functional

- Verification should timeout after 5s per command
- Should not execute commands (only --help)
- Safe to run in CI environments

## Edge Cases & Error Handling

1. **Tool not in PATH**: Report which commands couldn't be found
2. **Command hangs**: Timeout and report failure
3. **No CLI provides**: Skip tool or report "nothing to verify"
4. **Tool is a library**: Skip CLI verification (libraries don't have CLIs)

## Success Criteria

1. Can verify declared CLI commands exist
2. Detects missing commands with clear error messages
3. Works in CI (non-interactive, proper exit codes)
4. `--all` verifies entire ecosystem efficiently
