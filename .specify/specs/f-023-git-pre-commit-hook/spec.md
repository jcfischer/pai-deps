# F-023: Git Pre-commit Hook

## Overview

Provide installable git pre-commit hook functionality that runs contract verification on staged files before commit. Includes commands to install and uninstall the hook, with support for checking only staged changes.

## User Scenarios

### US-1: Install Pre-commit Hook

**Given** a developer is in a git repository with registered pai-deps tools
**When** they run `pai-deps hook install`
**Then** a pre-commit hook script is created in `.git/hooks/pre-commit`
**And** the hook is marked as executable
**And** a success message confirms installation

### US-2: Prevent Commit with Broken Contracts

**Given** a pre-commit hook is installed
**And** the developer has staged changes to a registered tool
**And** those changes break a CLI contract (e.g., schema drift)
**When** they run `git commit`
**Then** the pre-commit hook runs `pai-deps ci check --staged`
**And** the commit is blocked with exit code 1
**And** an error message shows which contracts failed

### US-3: Allow Commit with Valid Changes

**Given** a pre-commit hook is installed
**And** the developer has staged changes to a registered tool
**And** those changes do not break any contracts
**When** they run `git commit`
**Then** the pre-commit hook runs `pai-deps ci check --staged`
**And** the commit proceeds normally
**And** a brief success message is displayed

### US-4: Skip Check When No Registered Tools Changed

**Given** a pre-commit hook is installed
**And** the developer has staged changes to files NOT in any registered tool
**When** they run `git commit`
**Then** the hook completes immediately without running full checks
**And** the commit proceeds normally

### US-5: Uninstall Pre-commit Hook

**Given** a pre-commit hook installed by pai-deps exists
**When** the developer runs `pai-deps hook uninstall`
**Then** the pre-commit hook is removed
**And** a success message confirms removal

### US-6: Handle Existing Hook

**Given** a pre-commit hook already exists (not installed by pai-deps)
**When** the developer runs `pai-deps hook install`
**Then** the install fails with a clear error message
**And** the existing hook is not modified
**And** the user is informed about the `--force` option

### US-7: Force Install Over Existing Hook

**Given** a pre-commit hook already exists (not installed by pai-deps)
**When** the developer runs `pai-deps hook install --force`
**Then** the existing hook is backed up to `.git/hooks/pre-commit.backup`
**And** the pai-deps hook is installed
**And** a warning message notes the backup location

### US-8: Bypass Hook When Needed

**Given** a pre-commit hook is installed
**When** the developer runs `git commit --no-verify`
**Then** the hook is skipped (standard git behavior)
**And** the commit proceeds without pai-deps checks

### US-9: Check Hook Status

**Given** the developer wants to know if a hook is installed
**When** they run `pai-deps hook status`
**Then** they see whether a pai-deps hook is installed
**And** if installed, when it was installed
**And** if a non-pai-deps hook exists, that is noted

## Functional Requirements

### FR-1: Hook Install Command

```bash
pai-deps hook install [--force] [--quick]
```

- Creates `.git/hooks/pre-commit` script
- Sets executable permissions (chmod +x)
- Fails if not in a git repository
- Fails if hook exists (unless `--force`)
- `--quick` configures hook to use `pai-deps ci check --staged --quick`
- Hook script includes identifying comment marker for detection

### FR-2: Hook Uninstall Command

```bash
pai-deps hook uninstall
```

- Removes `.git/hooks/pre-commit` only if installed by pai-deps (identified by marker)
- Fails gracefully if no hook exists
- Fails gracefully if hook was not installed by pai-deps
- Restores backup if one exists (`.git/hooks/pre-commit.backup`)

### FR-3: Hook Status Command

```bash
pai-deps hook status [--json]
```

**Output includes:**
- Whether pai-deps hook is installed
- Hook configuration (quick mode, etc.)
- Whether backup exists
- Whether non-pai-deps hook exists

**JSON format:**
```json
{
  "installed": true,
  "installedAt": "2026-01-08T10:30:00Z",
  "quickMode": false,
  "backupExists": false,
  "foreignHookExists": false
}
```

### FR-4: Hook Script Behavior

The generated pre-commit hook script shall:
1. Check if `pai-deps` command exists; skip gracefully if not
2. Run `pai-deps ci check --staged [--quick]`
3. Exit with the same code as `pai-deps ci check`
4. Display a brief message indicating check is running
5. Support `--no-verify` bypass (native git behavior)
6. Include marker comment: `# pai-deps pre-commit hook`

### FR-5: Staged File Detection

The `--staged` flag on `pai-deps ci check` (from F-022) shall:
1. Get list of staged files via `git diff --cached --name-only`
2. Map staged files to registered tools
3. Only verify contracts for tools with staged changes
4. Exit 0 immediately if no staged files belong to registered tools

### FR-6: Hook Script Template

```bash
#!/bin/sh
# pai-deps pre-commit hook
# Installed: {timestamp}
# Quick mode: {true|false}

# Check if pai-deps is available
if ! command -v pai-deps >/dev/null 2>&1; then
  echo "pai-deps not found, skipping pre-commit checks"
  exit 0
fi

echo "Running pai-deps contract verification..."
pai-deps ci check --staged {--quick}
exit $?
```

## Non-Functional Requirements

### NFR-1: Performance

Pre-commit hook execution with `--quick` flag shall complete in under 3 seconds for typical projects (< 20 registered tools).

### NFR-2: Portability

Hook script shall be POSIX-compliant (`#!/bin/sh`) to work across macOS and Linux.

### NFR-3: Non-destructive

- Never modify existing hooks without `--force`
- Always create backup when overwriting
- Uninstall only removes pai-deps hooks

### NFR-4: Graceful Degradation

Hook shall skip gracefully (exit 0) if:
- `pai-deps` command is not available
- No staged files
- No registered tools affected

## Success Criteria

- [ ] `pai-deps hook install` creates working pre-commit hook
- [ ] `pai-deps hook uninstall` cleanly removes the hook
- [ ] `pai-deps hook status` shows accurate installation state
- [ ] Pre-commit hook blocks commits with broken contracts
- [ ] Pre-commit hook allows commits with valid changes
- [ ] Hook skips quickly when no registered tools have staged changes
- [ ] Existing non-pai-deps hooks are protected (require --force)
- [ ] Backup is created when using --force
- [ ] Hook works on both macOS and Linux
- [ ] All commands support `--json` output

## Exit Codes

### Hook Commands
- `0` - Success
- `1` - Operation failed (hook exists, not installed by pai-deps, etc.)
- `2` - Not in a git repository

### Pre-commit Hook Script
- `0` - All checks pass (or no checks needed)
- `1` - One or more checks failed (blocks commit)

## Assumptions

1. The `pai-deps ci check --staged` command from F-022 is implemented and working
2. Users have git installed and are working in git repositories
3. The `pai-deps` binary is available in PATH when hooks execute
4. Users understand `git commit --no-verify` to bypass hooks when needed

## Out of Scope

- Integration with other git hooks (post-commit, pre-push, etc.)
- Husky or other hook management tool integration
- Automatic installation during `pai-deps register`
- GitHub Actions workflow generation (separate feature)
- Hook configuration file (hooks use CLI flags only)
