# F-016: MCP Tool Schema Verification - Documentation

## Overview

This feature adds MCP (Model Context Protocol) tool verification to pai-deps. It verifies that MCP tools declared in manifests actually exist in the running MCP server by starting the server, querying its tools via JSON-RPC, and comparing against declarations.

## Usage

### Manifest Configuration

Add `mcp_start` to your manifest to enable MCP verification:

```yaml
name: my-tool
type: cli+mcp
mcp_start: bun run src/index.ts

provides:
  mcp:
    - tool: my_tool_name
    - tool: another_tool
```

### CLI Commands

```bash
# Verify all contracts (CLI + MCP)
pai-deps verify my-tool

# Verify only MCP tools
pai-deps verify my-tool --mcp-only

# Verify only CLI commands
pai-deps verify my-tool --cli-only

# Verify all registered tools
pai-deps verify --all

# With timeout (default: 5000ms)
pai-deps verify my-tool --timeout 10000

# JSON output
pai-deps verify my-tool --json
```

### Output

Human-readable output shows verification results:

```
Verifying MCP contracts for: my-tool

  ✓ my_tool_name                  Found in server
  ✓ another_tool                  Found in server
  + undeclared_tool               Extra (not declared)

Results: 2 found, 0 missing, 1 extra
```

JSON output structure:

```json
{
  "success": true,
  "mcp": {
    "results": [
      { "name": "my_tool_name", "status": "found", "declared": true, "inServer": true },
      { "name": "another_tool", "status": "found", "declared": true, "inServer": true },
      { "name": "undeclared_tool", "status": "extra", "declared": false, "inServer": true }
    ],
    "summary": {
      "tools": 3,
      "found": 2,
      "missing": 0,
      "extra": 1
    }
  }
}
```

## Library API

```typescript
import {
  startMcpServer,
  listMcpTools,
  verifyMcpTools,
  verifyMcpTool,
  type McpServer,
  type McpTool,
  type McpVerifyResult,
} from 'pai-deps';

// Start MCP server
const server = await startMcpServer('bun run src/index.ts', {
  timeout: 10000,
  cwd: '/path/to/tool',
});

// List available tools
const tools = await listMcpTools(server);

// Compare declared vs actual
const results = verifyMcpTools(
  ['declared_tool_1', 'declared_tool_2'],
  tools
);

// Clean up
server.close();

// Or use the convenience function
const result = await verifyMcpTool(
  'tool-id',
  ['tool_a', 'tool_b'],
  'bun run src/index.ts',
  '/path/to/tool',
  { timeout: 5000 }
);
```

## MCP Protocol Details

The verifier implements MCP protocol communication:

1. Spawns server process with stdio pipes
2. Sends `initialize` request with protocol version
3. Sends `notifications/initialized` notification
4. Sends `tools/list` request to get available tools
5. Compares declared tools against server response
6. Cleans up by closing the server

## Verification Statuses

| Status | Meaning |
|--------|---------|
| `found` | Tool declared in manifest and exists in server |
| `missing` | Tool declared in manifest but NOT in server |
| `extra` | Tool in server but NOT declared in manifest |

## Exit Codes

- `0`: All declared tools found (extra tools allowed)
- `1`: Missing tools detected or server error

## Files

- `src/lib/mcp-verifier.ts` - MCP server communication and verification logic
- `src/commands/verify.ts` - CLI command with MCP integration
- `tests/mcp-verifier.test.ts` - 8 tests for tool comparison logic

## Error Handling

- Server startup timeout: Returns error with all tools marked as missing
- Server exit during operation: Returns error status
- No mcp_start configured: Skips MCP verification with warning
- Server connection failure: Returns descriptive error message
