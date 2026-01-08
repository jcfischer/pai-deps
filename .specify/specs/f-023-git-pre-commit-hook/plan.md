# F-023: Git Pre-commit Hook - Technical Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         pai-deps hook command                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │   install   │    │   uninstall  │    │    status    │                │
│  └──────┬──────┘    └──────┬───────┘    └──────┬───────┘                │
│         │                  │                    │                        │
│         └──────────────────┼────────────────────┘                        │
│                            │                                             │
│                    ┌───────▼────────┐                                    │
│                    │  HookManager   │                                    │
│                    │   (lib/hook)   │                                    │
│                    └───────┬────────┘                                    │
│                            │                                             │
│         ┌──────────────────┼──────────────────┐                         │
│         │                  │                  │                         │
│  ┌──────▼──────┐   ┌───────▼───────┐  ┌──────▼──────┐                  │
│  │  findGitDir │   │generateScript │  │ parseHook   │                  │
│  └─────────────┘   └───────────────┘  └─────────────┘                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      Generated Hook Script                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  #!/bin/sh                                                               │
│  # pai-deps pre-commit hook                                              │
│  # Installed: {timestamp}                                                │
│  # Quick mode: {true|false}                                              │
│                                                                          │
│  if ! command -v pai-deps >/dev/null 2>&1; then                         │
│    echo "pai-deps not found, skipping"                                   │
│    exit 0                                                                │
│  fi                                                                      │
│                                                                          │
│  pai-deps ci check --staged [--quick]                                    │
│  exit $?                                                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Bun | Project standard |
| Language | TypeScript (strict) | Project standard |
| CLI | Commander.js | Existing pattern |
| Validation | Zod | Existing pattern |
| Shell Script | POSIX sh | Cross-platform (macOS/Linux) |
| File I/O | Node.js fs | Synchronous for simplicity |

## Data Model

### Hook Metadata (Embedded in Script)

The hook script contains metadata in comment form:

```typescript
interface HookMetadata {
  // Marker identifying pai-deps hooks
  marker: 'pai-deps pre-commit hook';

  // ISO timestamp of installation
  installedAt: string;

  // Whether --quick flag is enabled
  quickMode: boolean;
}
```

### Hook Status Response

```typescript
interface HookStatus {
  // Whether a pai-deps hook is installed
  installed: boolean;

  // Installation timestamp (if installed)
  installedAt: string | null;

  // Whether quick mode is enabled
  quickMode: boolean;

  // Whether backup file exists
  backupExists: boolean;

  // Whether a non-pai-deps hook exists
  foreignHookExists: boolean;
}
```

### Zod Schemas

```typescript
// Hook status output schema
const HookStatusSchema = z.object({
  installed: z.boolean(),
  installedAt: z.string().nullable(),
  quickMode: z.boolean(),
  backupExists: z.boolean(),
  foreignHookExists: z.boolean(),
});

// Install options schema
const InstallOptionsSchema = z.object({
  force: z.boolean().default(false),
  quick: z.boolean().default(false),
});
```

## File Structure

```
src/
├── commands/
│   └── hook.ts              # New: hook install|uninstall|status commands
│
├── lib/
│   └── hook/
│       ├── index.ts         # New: HookManager class export
│       ├── manager.ts       # New: Core hook management logic
│       ├── template.ts      # New: Hook script template generation
│       └── parser.ts        # New: Hook metadata parsing
│
tests/
└── hook.test.ts             # New: Hook command tests
```

## API Contracts

### CLI Commands

#### `pai-deps hook install`

```bash
pai-deps hook install [--force] [--quick]

Options:
  --force   Overwrite existing hook (creates backup)
  --quick   Configure hook to use --quick flag

Exit codes:
  0  Success
  1  Operation failed (hook exists, not --force)
  2  Not in a git repository
```

#### `pai-deps hook uninstall`

```bash
pai-deps hook uninstall

Exit codes:
  0  Success (hook removed or no hook existed)
  1  Hook exists but not installed by pai-deps
  2  Not in a git repository
```

#### `pai-deps hook status`

```bash
pai-deps hook status [--json]

Output (human):
  Pre-commit Hook Status
  ══════════════════════
  Installed: Yes
  Installed at: 2026-01-08 10:30:00
  Quick mode: No
  Backup exists: No

Output (JSON):
  {
    "installed": true,
    "installedAt": "2026-01-08T10:30:00Z",
    "quickMode": false,
    "backupExists": false,
    "foreignHookExists": false
  }

Exit codes:
  0  Success
  2  Not in a git repository
```

### Library Interface

```typescript
// lib/hook/manager.ts

export class HookManager {
  constructor(gitDir: string);

  /**
   * Install pre-commit hook
   * @throws if hook exists and force=false
   */
  install(options: { force?: boolean; quick?: boolean }): InstallResult;

  /**
   * Uninstall pre-commit hook
   * @returns true if hook was removed, false if no hook existed
   * @throws if hook exists but was not installed by pai-deps
   */
  uninstall(): UninstallResult;

  /**
   * Get hook status
   */
  status(): HookStatus;

  /**
   * Check if hook is a pai-deps hook
   */
  isPaiDepsHook(): boolean;
}

interface InstallResult {
  success: boolean;
  backupCreated: boolean;
  hookPath: string;
}

interface UninstallResult {
  success: boolean;
  backupRestored: boolean;
}
```

## Implementation Phases

### Phase 1: Core Library (lib/hook/)

1. **manager.ts** - HookManager class with:
   - `findGitDir()` - Locate .git directory
   - `getHookPath()` - Return .git/hooks/pre-commit path
   - `getBackupPath()` - Return .git/hooks/pre-commit.backup path
   - `install()` - Write hook script with appropriate mode (0755)
   - `uninstall()` - Remove hook, optionally restore backup
   - `status()` - Return current hook state

2. **template.ts** - Hook script generation:
   - `generateHookScript(options)` - Create POSIX-compliant script
   - Include marker, timestamp, and config in comments

3. **parser.ts** - Hook metadata parsing:
   - `parseHookMetadata(content)` - Extract metadata from script
   - `isPaiDepsHook(content)` - Check for marker comment

### Phase 2: CLI Commands (commands/hook.ts)

1. Create `hook` parent command
2. Implement `hook install` subcommand
3. Implement `hook uninstall` subcommand
4. Implement `hook status` subcommand
5. Register in `src/index.ts`

### Phase 3: Integration & Testing

1. Unit tests for HookManager
2. Integration tests with real git repositories
3. Edge case tests (existing hooks, permissions, etc.)

## Dependencies

### Internal Dependencies

| Module | Usage |
|--------|-------|
| `lib/ci/git.ts` | `isGitRepo()`, `getRepoRoot()` |
| `lib/output.ts` | `getGlobalOptions()`, `error()`, `success()` |

### External Dependencies

No new dependencies required. Uses existing:
- `commander` - CLI framework
- `node:fs` - File operations
- `node:path` - Path manipulation
- `node:child_process` - Git commands (via existing git utilities)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing hook overwritten accidentally | Medium | High | Require `--force`, always backup |
| Hook script not executable | Low | High | Explicitly set chmod 0755 |
| pai-deps not in PATH at commit time | Medium | Low | Graceful skip with message |
| Hook breaks non-bash shells | Low | Medium | Use POSIX sh, not bash |
| Cross-platform path issues | Low | Low | Use node:path for resolution |

## Testing Strategy

### Unit Tests

```typescript
describe('HookManager', () => {
  describe('install', () => {
    it('creates hook script with correct content');
    it('sets executable permissions');
    it('fails if hook exists without --force');
    it('creates backup when using --force');
    it('includes quick flag when specified');
  });

  describe('uninstall', () => {
    it('removes pai-deps hook');
    it('refuses to remove foreign hook');
    it('restores backup if exists');
    it('succeeds if no hook exists');
  });

  describe('status', () => {
    it('detects installed pai-deps hook');
    it('detects foreign hook');
    it('detects backup file');
    it('parses installation timestamp');
    it('parses quick mode setting');
  });
});
```

### Integration Tests

- Test with actual git repository (temp directory)
- Test hook execution via git commit
- Test interaction with `pai-deps ci check --staged`

## Edge Cases

1. **Symlinked .git directory** - Follow symlinks via `fs.realpathSync`
2. **Worktree repository** - Handle `.git` file pointing to gitdir
3. **Hook script with CRLF** - Normalize line endings on read/write
4. **No .git/hooks directory** - Create if missing
5. **Hook script owned by root** - Permission error handling

## Success Criteria Mapping

| Criterion | Implementation |
|-----------|----------------|
| `hook install` creates working hook | Phase 2 + tests |
| `hook uninstall` cleanly removes hook | Phase 2 + tests |
| `hook status` shows accurate state | Phase 2 + tests |
| Hook blocks commits with broken contracts | Relies on `ci check --staged` |
| Hook allows commits with valid changes | Relies on `ci check --staged` |
| Hook skips quickly when no tools staged | Relies on `ci check --staged` |
| Existing hooks protected | `--force` requirement |
| Backup created when using --force | Phase 1 |
| Works on macOS and Linux | POSIX sh compliance |
| All commands support `--json` | Phase 2 |
