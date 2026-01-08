# F-023: Git Pre-commit Hook - Documentation Updates

## Files Created

### Source Files
- `src/lib/hook/index.ts` - Barrel export for hook module
- `src/lib/hook/types.ts` - Type definitions and Zod schemas
- `src/lib/hook/template.ts` - Hook script template generator
- `src/lib/hook/parser.ts` - Hook metadata parser
- `src/lib/hook/manager.ts` - HookManager class for install/uninstall/status
- `src/commands/hook.ts` - CLI command handlers

### Test Files
- `tests/hook.test.ts` - 37 tests covering all hook functionality

## Files Modified

- `src/index.ts` - Added import and registration for hookCommand

## CLI Commands Added

```
pai-deps hook install [--force] [--quick]
pai-deps hook uninstall
pai-deps hook status [--json]
```

## README.md Updates Required

Add to Commands section:

```markdown
### Hook Management

```bash
# Install pre-commit hook
pai-deps hook install

# Install with quick mode (faster checks)
pai-deps hook install --quick

# Force install over existing hook (creates backup)
pai-deps hook install --force

# Check hook status
pai-deps hook status

# JSON output
pai-deps hook status --json

# Remove hook
pai-deps hook uninstall
```

## Exit Codes

| Command | Code | Meaning |
|---------|------|---------|
| hook install | 0 | Success |
| hook install | 1 | Hook exists (use --force) |
| hook install | 2 | Not in git repository |
| hook uninstall | 0 | Success |
| hook uninstall | 1 | Hook is foreign (not installed by pai-deps) |
| hook uninstall | 2 | Not in git repository |
| hook status | 0 | Success |
| hook status | 2 | Not in git repository |
