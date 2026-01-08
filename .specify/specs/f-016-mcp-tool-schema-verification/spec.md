# Feature Specification: F-016 MCP Tool Schema Verification

## Problem Statement

We can verify CLI commands exist (F-013), but we cannot verify that MCP tools declared in manifests actually exist in the running MCP server. This creates a gap where manifest declarations can drift from actual MCP implementations.

## Users & Stakeholders

- **Primary**: Developers maintaining MCP servers who want to ensure manifest accuracy
- **Secondary**: CI pipelines validating MCP tool contracts

## Current State

- Manifests declare MCP tools via `provides.mcp: [{ tool: "name" }]`
- CLI verification (`pai-deps verify`) only checks CLI commands
- No mechanism to query actual MCP servers for their tool list
- MCP servers communicate via JSON-RPC over stdio

## Requirements

### Functional

1. **Extend `pai-deps verify` to check MCP tools**
   - Start the MCP server using configured start command
   - Send `tools/list` JSON-RPC request via stdio
   - Compare response with declared tools in manifest
   - Report missing and extra tools

2. **`pai-deps verify --mcp-only`** - Only verify MCP contracts (skip CLI)

3. **Configure MCP server start command in manifest**
   ```yaml
   provides:
     mcp:
       start: "bun run src/index.ts"  # How to start the server
       tools:
         - tool: email_search
         - tool: email_send
   ```

### Non-Functional

- Timeout for MCP server startup (default 10s)
- Clean shutdown of MCP server after verification
- Exit code 0 for pass, 1 for failures

## User Experience

```bash
# Verify all contracts (CLI + MCP)
pai-deps verify email-mcp

# Verify only MCP tools
pai-deps verify email-mcp --mcp-only

# Verify all tools
pai-deps verify --all
```

### Output Format

```
Verifying MCP contracts for: email-mcp

  ✓ email_search                 Found in server
  ✓ email_send                   Found in server
  ✗ email_delete                 Not found in server (declared in manifest)
  + email_draft                  Extra tool (not declared in manifest)

Results: 2 passed, 1 failed, 1 extra
```

## Edge Cases & Error Handling

- MCP server fails to start → Report startup error, skip verification
- Server doesn't respond to tools/list → Timeout error
- Server has no tools → Report as empty (may be valid)
- Manifest has no start command → Skip MCP verification with warning

## Success Criteria

- [ ] Can start an MCP server from manifest config
- [ ] Can query tools/list via JSON-RPC stdio
- [ ] Reports missing tools (declared but not in server)
- [ ] Reports extra tools (in server but not declared)
- [ ] Clean server shutdown after verification
- [ ] JSON output mode for CI

## Scope

### In Scope
- MCP tool presence verification
- Starting/stopping MCP servers
- JSON-RPC communication via stdio
- Integration with existing verify command

### Explicitly Out of Scope
- MCP resource verification (separate feature)
- Tool input/output schema validation (use verify-output)
- Long-running server monitoring
- MCP prompts verification

## Open Questions

1. Should we support MCP servers that are already running (connect to existing)?
   - **Decision**: Start fresh for now, add connect-to-existing later

2. How to handle servers that require environment setup?
   - **Decision**: Use current working directory, inherit env from pai-deps process
