# Implementation Tasks: F-013 CLI Contract Verification

## Task 1: Create verifier library

Create `src/lib/verifier.ts`:

1. Define types:
   ```typescript
   interface VerifyCheck {
     exists: boolean;
     helpAvailable?: boolean;
   }

   interface VerifyResult {
     command: string;
     status: 'pass' | 'fail' | 'skip';
     error?: string;
     checks: VerifyCheck;
     duration: number;
   }

   interface ToolVerifyResult {
     tool: string;
     type: string;
     results: VerifyResult[];
     summary: { passed: number; failed: number; skipped: number; total: number };
   }

   interface VerifyOptions {
     quick?: boolean;
     strict?: boolean;
     timeout?: number;
   }
   ```

2. Implement `runCommand(cmd, args, timeout)`:
   - Spawn child process
   - Handle timeout with AbortController
   - Return { stdout, stderr, exitCode }

3. Implement `verifyCliCommand(command, options)`:
   - Parse command into binary and subcommands
   - Run with --help flag
   - Check exit code
   - Return VerifyResult

4. Implement `verifyTool(toolId, db, options)`:
   - Load tool from database
   - Get manifest from tool path
   - Extract CLI provides
   - Verify each command
   - Aggregate results

## Task 2: Create verify command

Create `src/commands/verify.ts`:

1. Command definition:
   - `verify [tool]` - optional tool argument
   - `-a, --all` - verify all tools
   - `--quick` - existence check only
   - `--strict` - also verify options (future)
   - `--timeout <ms>` - per-command timeout

2. Implementation:
   - If tool specified, verify single tool
   - If --all, verify all CLI/MCP tools (skip libraries)
   - Format output (table or JSON)
   - Set exit code based on results

3. Output formatting:
   - Use checkmarks/crosses for pass/fail
   - Show command, status, error message
   - Summary at end

## Task 3: Register command

Update `src/index.ts`:
1. Import verifyCommand
2. Register with program

## Task 4: Add tests

Create `tests/verify.test.ts`:

1. Test verifying existing command (e.g., `ls --help`)
2. Test verifying non-existent command
3. Test timeout handling
4. Test tool with no CLI provides
5. Test JSON output format
6. Test --all option

## Verification

```bash
bun test
bun run typecheck

# Manual testing
pai-deps verify pai-deps          # verify itself
pai-deps verify --all             # verify all tools
pai-deps verify email --json      # JSON output
pai-deps verify nonexistent       # should error
```
