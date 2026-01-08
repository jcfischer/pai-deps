# Implementation Tasks: F-016 MCP Tool Schema Verification

## Task List

### 1. Create MCP Verifier Module
- [ ] Create `src/lib/mcp-verifier.ts`
- [ ] Implement `startMcpServer(command, cwd, timeout)` - spawn process with stdio
- [ ] Implement JSON-RPC request/response handling over stdio
- [ ] Implement `listMcpTools(server)` - send tools/list request
- [ ] Implement `verifyMcpTools(declared, serverTools)` - comparison logic
- [ ] Implement `stopMcpServer(server)` - clean shutdown
- [ ] Export from `src/lib/index.ts`

### 2. Write MCP Verifier Tests
- [ ] Create `tests/mcp-verifier.test.ts`
- [ ] Test verifyMcpTools comparison logic
- [ ] Test JSON-RPC message parsing
- [ ] Test timeout handling
- [ ] Mock child process for unit tests

### 3. Update Manifest Schema (Optional)
- [ ] Add `start` field to MCP provides schema
- [ ] Update manifest tests if schema changes

### 4. Extend Verify Command
- [ ] Add `--mcp-only` option
- [ ] Integrate MCP verification into verify flow
- [ ] Format MCP verification results
- [ ] Handle MCP errors gracefully

### 5. Write Integration Tests
- [ ] Test verify command with MCP tools
- [ ] Test --mcp-only flag
- [ ] Test error cases (no start command, server fails)

### 6. Update Documentation
- [ ] Update README.md with MCP verification
- [ ] Update CLAUDE.md files
- [ ] Create docs.md for this feature

### 7. Final Verification
- [ ] Run all tests (`bun test`)
- [ ] Run typecheck (`bun run typecheck`)
- [ ] Manual testing with real MCP server

## Definition of Done

- [ ] `pai-deps verify <tool>` checks both CLI and MCP contracts
- [ ] `pai-deps verify <tool> --mcp-only` checks only MCP
- [ ] Reports missing and extra tools
- [ ] Clean server shutdown
- [ ] JSON output mode works
- [ ] All tests pass
