# Technical Plan: F-013 CLI Contract Verification

## Architecture

### Files to Modify/Create

```
src/
├── commands/
│   └── verify.ts         # NEW: verify command
├── lib/
│   └── verifier.ts       # NEW: CLI verification logic
└── index.ts              # Register verify command
```

## Implementation Approach

### 1. Verification Library

Create `src/lib/verifier.ts`:

```typescript
interface VerifyResult {
  command: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  checks: {
    exists: boolean;
    helpAvailable?: boolean;
    optionsMatch?: boolean;
  };
  duration: number;
}

interface ToolVerifyResult {
  tool: string;
  results: VerifyResult[];
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
}

async function verifyCliCommand(
  command: string,
  options?: { strict?: boolean; timeout?: number }
): Promise<VerifyResult>;

async function verifyTool(
  toolId: string,
  manifest: Manifest,
  options?: VerifyOptions
): Promise<ToolVerifyResult>;
```

### 2. Command Execution

Use `child_process.spawn` with timeout:
1. Run `<command> --help`
2. Capture stdout/stderr
3. Check exit code (0 = exists)
4. Parse help output for option verification

### 3. Command Structure

```bash
pai-deps verify [tool] [options]

Arguments:
  tool                Tool ID to verify (optional, use --all for all)

Options:
  -a, --all           Verify all registered tools
  --quick             Only check command existence
  --strict            Also verify declared options
  --timeout <ms>      Timeout per command (default: 5000)
  --json              JSON output
```

### 4. Help Output Parsing

For `--strict` mode, parse --help output:
1. Look for `-<short>, --<long>` patterns
2. Extract option names
3. Compare against declared options in manifest
4. Report missing/extra options

## Testing Strategy

1. Test with known working commands
2. Test with non-existent commands
3. Test timeout handling
4. Test help parsing
5. Mock subprocess for unit tests

## Considerations

- Some tools may not be installed locally
- Help output format varies between tools
- Timeout handling is critical for CI
- Should work with both bundled and non-bundled CLIs
