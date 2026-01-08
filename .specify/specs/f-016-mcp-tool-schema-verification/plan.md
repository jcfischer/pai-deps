# Technical Plan: F-016 MCP Tool Schema Verification

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    verify command                        │
│  Extended to support --mcp-only option                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              MCP Verifier Module                         │
│  src/lib/mcp-verifier.ts                                │
│  - startMcpServer(cmd, cwd)                             │
│  - listMcpTools(server)                                 │
│  - verifyMcpTools(manifest, serverTools)                │
│  - stopMcpServer(server)                                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 MCP Server Process                       │
│  Spawned child process with stdio transport             │
│  JSON-RPC 2.0 protocol                                  │
└─────────────────────────────────────────────────────────┘
```

## MCP Protocol Flow

```
1. Spawn server process with stdin/stdout
2. Send: {"jsonrpc": "2.0", "method": "initialize", "params": {...}, "id": 1}
3. Recv: {"jsonrpc": "2.0", "result": {...}, "id": 1}
4. Send: {"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 2}
5. Recv: {"jsonrpc": "2.0", "result": {"tools": [...]}, "id": 2}
6. Kill process
```

## File Structure

```
src/
├── lib/
│   ├── mcp-verifier.ts     # New MCP verification module
│   └── index.ts            # Add exports
├── commands/
│   └── verify.ts           # Extend with MCP support
└── index.ts
```

## Implementation Details

### 1. MCP Verifier Module (`src/lib/mcp-verifier.ts`)

```typescript
import { spawn, ChildProcess } from 'node:child_process';

export interface McpServer {
  process: ChildProcess;
  sendRequest<T>(method: string, params?: object): Promise<T>;
  close(): void;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: object;
}

export interface McpVerifyResult {
  tool: string;
  type: 'mcp';
  results: McpToolResult[];
  summary: { found: number; missing: number; extra: number };
}

export interface McpToolResult {
  name: string;
  status: 'found' | 'missing' | 'extra';
  declared: boolean;
  inServer: boolean;
}

// Start MCP server and return interface
export async function startMcpServer(
  command: string,
  cwd: string,
  timeout?: number
): Promise<McpServer>;

// List tools from running server
export async function listMcpTools(server: McpServer): Promise<McpTool[]>;

// Compare manifest tools with server tools
export function verifyMcpTools(
  declaredTools: string[],
  serverTools: McpTool[]
): McpToolResult[];
```

### 2. JSON-RPC Communication

```typescript
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: object;
  id: number;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  result?: T;
  error?: { code: number; message: string };
  id: number;
}
```

### 3. Manifest Schema Extension

Update `manifest.ts` to support MCP start command:

```typescript
export const McpProvidesBlockSchema = z.object({
  start: z.string().optional(),  // Command to start server
  tools: z.array(McpToolProvidesSchema).optional(),
  resources: z.array(McpResourceProvidesSchema).optional(),
});
```

### 4. Verify Command Extension

Add `--mcp-only` flag and integrate MCP verification:

```typescript
interface VerifyCommandOptions {
  all?: boolean;
  quick?: boolean;
  timeout?: string;
  mcpOnly?: boolean;  // New
}
```

## Error Handling

| Error | Response |
|-------|----------|
| No start command | Skip MCP verification, warn |
| Server fails to start | Report error, continue with CLI |
| Server doesn't respond | Timeout error after 10s |
| JSON-RPC error | Report error details |
| Unexpected tools | Report as "extra" (warning) |

## Testing Strategy

1. **Unit tests for mcp-verifier.ts**
   - Mock child process for server
   - Test JSON-RPC message parsing
   - Test tool comparison logic

2. **Integration tests** (if we have a test MCP server)
   - Start real server
   - Verify tools/list works
   - Clean shutdown

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Different MCP server implementations | Follow spec strictly |
| Servers that hang on startup | Timeout + kill |
| Servers needing env vars | Document, inherit from process |
| Concurrent verification requests | Sequential for now |
