# F-022: Implementation Tasks

## Phase 1: Git Utilities

- [ ] **1.1** Create `src/lib/ci/git.ts` with `getChangedFiles(base: string): string[]`
  - Use `git diff --name-only ${base}...HEAD`
  - Handle missing base branch gracefully
  - Return absolute paths

- [ ] **1.2** Add `getStagedFiles(): string[]`
  - Use `git diff --cached --name-only`
  - Return absolute paths

- [ ] **1.3** Add `getDefaultBranch(): string`
  - Try `git symbolic-ref refs/remotes/origin/HEAD`
  - Fall back to 'main' then 'master'

- [ ] **1.4** Add `isGitRepo(): boolean`
  - Check if current directory is a git repository
  - Return false gracefully if not

## Phase 2: File-to-Tool Mapper

- [ ] **2.1** Create `src/lib/ci/mapper.ts` with `mapFileToTool(filePath: string, db): string | null`
  - Walk up directory tree from file
  - Look for pai-manifest.yaml
  - Return tool ID if found and registered

- [ ] **2.2** Add `mapFilesToTools(files: string[], db): Map<string, string[]>`
  - Map multiple files efficiently
  - Cache manifest locations during traversal
  - Return Map<toolId, files[]>

- [ ] **2.3** Add `findToolByPath(dirPath: string, db): Tool | null`
  - Query tools table by path prefix
  - Handle nested tool directories

## Phase 3: Check Aggregator

- [ ] **3.1** Create `src/lib/ci/checker.ts` with `CiCheckResult` interface

- [ ] **3.2** Add `runDriftCheck(toolIds: string[], db): DriftCheckResult`
  - Reuse existing hasher.ts logic
  - Return list of drifted contracts

- [ ] **3.3** Add `runVerifyCheck(toolIds: string[], db, options): VerifyCheckResult`
  - Reuse existing verifier.ts
  - Support quick mode (skip MCP)

- [ ] **3.4** Add `runDependencyCheck(db): DependencyCheckResult`
  - Check for cycles using existing graph
  - Check for missing dependencies (stub references)

- [ ] **3.5** Add `runAllChecks(options): CiCheckResult`
  - Orchestrate all checks
  - Support --quick mode
  - Support --staged filtering

## Phase 4: ci check Command

- [ ] **4.1** Create `src/commands/ci.ts` with base `ci` subcommand

- [ ] **4.2** Implement `ci check` subcommand
  - Options: --quick, --fix, --staged
  - Wire up checker.ts
  - JSON output support

- [ ] **4.3** Implement exit codes
  - 0: All checks pass
  - 1: One or more checks failed
  - 2: Configuration/runtime error

- [ ] **4.4** Add human-readable output formatting
  - Show each check category with ✓/✗
  - Summary line at end

## Phase 5: ci affected Command

- [ ] **5.1** Implement `ci affected` subcommand in ci.ts
  - Options: --base, --direct, --list
  - Use git.ts for changed files
  - Use mapper.ts for file→tool

- [ ] **5.2** Integrate with existing DependencyGraph
  - Get transitive dependents for each changed tool
  - Deduplicate results

- [ ] **5.3** Track "via" path for affected tools
  - Show which changed tool causes each affected tool

- [ ] **5.4** Implement output formats
  - Human readable (default)
  - JSON (--json)
  - List (--list) - tool names only, one per line

## Phase 6: Testing

- [ ] **6.1** Create `tests/ci.test.ts`

- [ ] **6.2** Test git utilities
  - Mock execSync for deterministic tests
  - Test error handling for non-git directories

- [ ] **6.3** Test file-to-tool mapper
  - Use temp directories with mock manifests
  - Test nested directories

- [ ] **6.4** Test check aggregator
  - Mock individual check functions
  - Test quick mode skips correctly

- [ ] **6.5** Test ci check command
  - Integration test with real DB
  - Test exit codes
  - Test JSON output

- [ ] **6.6** Test ci affected command
  - Test with mock git changes
  - Test transitive vs direct modes
  - Test output formats

## Phase 7: Integration & Polish

- [ ] **7.1** Register ci command in src/index.ts

- [ ] **7.2** Add lib/ci/index.ts barrel export

- [ ] **7.3** Update README.md with new commands

- [ ] **7.4** Run full test suite, fix any regressions

- [ ] **7.5** Manual testing with real PAI tools
