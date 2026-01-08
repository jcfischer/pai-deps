# F-023: Git Pre-commit Hook - Implementation Tasks

## Progress Tracking

| Group | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| 1. Foundation | 4 | 0 | Pending |
| 2. Core Hook Logic | 4 | 0 | Pending |
| 3. CLI Commands | 4 | 0 | Pending |
| 4. Integration | 2 | 0 | Pending |
| **Total** | **14** | **0** | **0%** |

---

## Group 1: Foundation

### T-1.1: Create hook module directory structure [P]
- File: `src/lib/hook/index.ts`
- Dependencies: none
- Description: Create the `src/lib/hook/` directory with index.ts barrel export

### T-1.2: Define hook types and Zod schemas [T]
- File: `src/lib/hook/types.ts`
- Test: `tests/hook.test.ts` (schema validation tests)
- Dependencies: none
- Description: Define `HookMetadata`, `HookStatus`, `InstallResult`, `UninstallResult` interfaces and Zod schemas (`HookStatusSchema`, `InstallOptionsSchema`)

### T-1.3: Implement git directory finder [T]
- File: `src/lib/hook/git.ts`
- Test: `tests/hook.test.ts` (git directory detection tests)
- Dependencies: none
- Description: Implement `findGitDir()` function that locates `.git` directory, handles worktrees (`.git` file), and follows symlinks. Uses existing `isGitRepo()` and `getRepoRoot()` from `lib/ci/git.ts` where appropriate.

### T-1.4: Implement hook script template generator [T]
- File: `src/lib/hook/template.ts`
- Test: `tests/hook.test.ts` (template generation tests)
- Dependencies: T-1.2
- Description: Implement `generateHookScript(options: { quick: boolean })` that returns POSIX-compliant shell script with:
  - Marker comment: `# pai-deps pre-commit hook`
  - Installation timestamp
  - Quick mode flag
  - Graceful skip if `pai-deps` not in PATH
  - Call to `pai-deps ci check --staged [--quick]`

---

## Group 2: Core Hook Logic

### T-2.1: Implement hook metadata parser [T]
- File: `src/lib/hook/parser.ts`
- Test: `tests/hook.test.ts` (parsing tests)
- Dependencies: T-1.2, T-1.4
- Description: Implement:
  - `parseHookMetadata(content: string): HookMetadata | null`
  - `isPaiDepsHook(content: string): boolean`
  - Parse marker, timestamp, and quick mode from hook script comments

### T-2.2: Implement HookManager.install() [T]
- File: `src/lib/hook/manager.ts`
- Test: `tests/hook.test.ts` (install tests)
- Dependencies: T-1.3, T-1.4, T-2.1
- Description: Implement `install(options: { force?: boolean; quick?: boolean }): InstallResult`:
  - Check git repo exists
  - Create `.git/hooks/` directory if missing
  - Check for existing hook (fail without `--force`)
  - Create backup when using `--force`
  - Write hook script with executable permissions (0o755)
  - Return `InstallResult` with success/backup info

### T-2.3: Implement HookManager.uninstall() [T]
- File: `src/lib/hook/manager.ts`
- Test: `tests/hook.test.ts` (uninstall tests)
- Dependencies: T-1.3, T-2.1
- Description: Implement `uninstall(): UninstallResult`:
  - Return success if no hook exists
  - Fail if hook exists but is not pai-deps hook
  - Remove pai-deps hook
  - Restore backup if exists (`.git/hooks/pre-commit.backup`)
  - Return `UninstallResult` with success/restore info

### T-2.4: Implement HookManager.status() [T]
- File: `src/lib/hook/manager.ts`
- Test: `tests/hook.test.ts` (status tests)
- Dependencies: T-1.3, T-2.1
- Description: Implement `status(): HookStatus`:
  - Check if hook file exists
  - Parse metadata if pai-deps hook
  - Check for backup file
  - Check for foreign (non-pai-deps) hook
  - Return full `HookStatus` object

---

## Group 3: CLI Commands

### T-3.1: Create hook command skeleton [P]
- File: `src/commands/hook.ts`
- Dependencies: none
- Description: Create `hookCommand(program: Command)` with parent `hook` command and placeholder subcommands. Register in `src/index.ts`.

### T-3.2: Implement `hook install` command [T]
- File: `src/commands/hook.ts`
- Test: `tests/hook.test.ts` (CLI install tests)
- Dependencies: T-2.2, T-3.1
- Description: Implement `hook install [--force] [--quick]`:
  - Validate git repository (exit 2 if not)
  - Call `HookManager.install()`
  - Human-readable success/error messages
  - JSON output support (`--json`)
  - Exit codes: 0 success, 1 failed, 2 not git repo

### T-3.3: Implement `hook uninstall` command [T]
- File: `src/commands/hook.ts`
- Test: `tests/hook.test.ts` (CLI uninstall tests)
- Dependencies: T-2.3, T-3.1
- Description: Implement `hook uninstall`:
  - Validate git repository (exit 2 if not)
  - Call `HookManager.uninstall()`
  - Human-readable success/error messages
  - JSON output support
  - Exit codes: 0 success, 1 foreign hook, 2 not git repo

### T-3.4: Implement `hook status` command [T]
- File: `src/commands/hook.ts`
- Test: `tests/hook.test.ts` (CLI status tests)
- Dependencies: T-2.4, T-3.1
- Description: Implement `hook status [--json]`:
  - Validate git repository (exit 2 if not)
  - Call `HookManager.status()`
  - Format human-readable output with installation info
  - JSON output matching `HookStatus` schema
  - Exit codes: 0 success, 2 not git repo

---

## Group 4: Integration

### T-4.1: Integration tests with real git repository [T]
- File: `tests/hook-integration.test.ts`
- Dependencies: T-3.2, T-3.3, T-3.4
- Description: End-to-end tests:
  - Create temp git repository
  - Install hook and verify script content
  - Verify hook is executable
  - Uninstall hook and verify removal
  - Force install over existing hook
  - Backup creation and restoration
  - Status reporting accuracy

### T-4.2: Export hook module from index [P]
- File: `src/lib/hook/index.ts`
- Dependencies: T-2.2, T-2.3, T-2.4
- Description: Export `HookManager` class and types from `src/lib/hook/index.ts` barrel file

---

## Execution Order

**Phase 1: Foundation (parallel)**
- T-1.1, T-1.2, T-1.3, T-1.4 can run in parallel

**Phase 2: Core Logic (sequential within, parallel across)**
- T-2.1 (depends on T-1.2, T-1.4)
- T-2.2, T-2.3, T-2.4 (depend on T-2.1, can be parallel after)

**Phase 3: CLI Commands (sequential)**
- T-3.1 first (skeleton)
- T-3.2, T-3.3, T-3.4 can be parallel after T-3.1

**Phase 4: Integration**
- T-4.1, T-4.2 after all Phase 3 complete

---

## File Summary

| File | Tasks | New/Modify |
|------|-------|------------|
| `src/lib/hook/index.ts` | T-1.1, T-4.2 | New |
| `src/lib/hook/types.ts` | T-1.2 | New |
| `src/lib/hook/git.ts` | T-1.3 | New |
| `src/lib/hook/template.ts` | T-1.4 | New |
| `src/lib/hook/parser.ts` | T-2.1 | New |
| `src/lib/hook/manager.ts` | T-2.2, T-2.3, T-2.4 | New |
| `src/commands/hook.ts` | T-3.1, T-3.2, T-3.3, T-3.4 | New |
| `src/index.ts` | T-3.1 | Modify |
| `tests/hook.test.ts` | T-1.2, T-1.3, T-1.4, T-2.1-T-2.4, T-3.2-T-3.4 | New |
| `tests/hook-integration.test.ts` | T-4.1 | New |

---

## Test Coverage Requirements

Each `[T]` task includes tests for:
- Happy path scenarios
- Error conditions
- Edge cases (existing hooks, permissions, symlinks)
- JSON output format validation
- Exit code verification

---

## Dependencies on Other Features

- **F-022 (CI Integration)**: `pai-deps ci check --staged` must be implemented and working
- Uses existing `lib/ci/git.ts` utilities: `isGitRepo()`, `getRepoRoot()`
