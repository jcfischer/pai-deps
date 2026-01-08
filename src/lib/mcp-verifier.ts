/**
 * MCP Server Verifier for pai-deps
 *
 * Verifies that MCP tools declared in manifests actually exist
 * in the running MCP server.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

/**
 * JSON-RPC 2.0 request
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: object;
  id: number;
}

/**
 * JSON-RPC 2.0 response
 */
interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number;
}

/**
 * MCP tool from tools/list response
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: object;
}

/**
 * Result of tools/list request
 */
interface ToolsListResult {
  tools: McpTool[];
}

/**
 * MCP server interface for communication
 */
export interface McpServer {
  /** Send a JSON-RPC request and wait for response */
  sendRequest<T>(method: string, params?: object): Promise<T>;
  /** Close the server connection */
  close(): void;
  /** Whether the server is still running */
  isRunning(): boolean;
}

/**
 * Result of verifying a single MCP tool
 */
export interface McpToolResult {
  name: string;
  status: 'found' | 'missing' | 'extra';
  declared: boolean;
  inServer: boolean;
}

/**
 * Result of verifying all MCP tools for a tool
 */
export interface McpVerifyResult {
  tool: string;
  type: 'mcp';
  serverStarted: boolean;
  error?: string;
  results: McpToolResult[];
  summary: {
    found: number;
    missing: number;
    extra: number;
    total: number;
  };
}

/**
 * Options for starting MCP server
 */
export interface McpServerOptions {
  /** Timeout for server startup in ms (default: 10000) */
  timeout?: number;
  /** Working directory for server process */
  cwd?: string;
}

/**
 * Internal server implementation
 */
class McpServerImpl extends EventEmitter implements McpServer {
  private process: ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';
  private closed = false;

  constructor(process: ChildProcess) {
    super();
    this.process = process;

    // Handle stdout data
    process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // Handle stderr (log but don't fail)
    process.stderr?.on('data', () => {
      // MCP servers often log to stderr, ignore
    });

    // Handle process exit
    process.on('exit', (code) => {
      this.closed = true;
      this.emit('exit', code);
      // Reject all pending requests
      for (const [id, { reject }] of this.pendingRequests) {
        reject(new Error(`Server exited with code ${code}`));
        this.pendingRequests.delete(id);
      }
    });

    process.on('error', (err) => {
      this.closed = true;
      this.emit('error', err);
    });
  }

  private processBuffer(): void {
    // MCP uses newline-delimited JSON
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line) as JsonRpcResponse;
        this.handleResponse(response);
      } catch {
        // Ignore parse errors (might be log output)
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(`MCP error: ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  async sendRequest<T>(method: string, params?: object): Promise<T> {
    if (this.closed) {
      throw new Error('Server connection is closed');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params: params || {},
      id,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const message = JSON.stringify(request) + '\n';
      this.process.stdin?.write(message, (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          reject(err);
        }
      });
    });
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.process.kill('SIGTERM');
    }
  }

  isRunning(): boolean {
    return !this.closed;
  }
}

/**
 * Start an MCP server process
 */
export async function startMcpServer(
  command: string,
  options: McpServerOptions = {}
): Promise<McpServer> {
  const { timeout = 10000, cwd } = options;

  // Parse command into parts
  const parts = command.split(/\s+/);
  const cmd = parts[0]!;
  const args = parts.slice(1);

  // Spawn the server process
  const proc = spawn(cmd, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  const server = new McpServerImpl(proc);

  // Wait for process to be ready with timeout
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`Server startup timed out after ${timeout}ms`));
    }, timeout);

    // Try to initialize the connection
    const tryInitialize = async () => {
      try {
        // Send initialize request
        await server.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'pai-deps',
            version: '1.0.0',
          },
        });

        // Send initialized notification (no response expected for notifications)
        server.sendRequest('notifications/initialized', {}).catch(() => {
          // Notifications don't get responses, ignore errors
        });

        clearTimeout(timer);
        resolve(server);
      } catch (err) {
        // If not ready yet, retry after a short delay
        if (server.isRunning()) {
          setTimeout(tryInitialize, 100);
        } else {
          clearTimeout(timer);
          reject(err);
        }
      }
    };

    // Give the server a moment to start
    setTimeout(tryInitialize, 200);

    // Handle early exit
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with code ${code} during startup`));
    });

    server.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * List tools from a running MCP server
 */
export async function listMcpTools(server: McpServer): Promise<McpTool[]> {
  const result = await server.sendRequest<ToolsListResult>('tools/list', {});
  return result.tools || [];
}

/**
 * Compare declared tools with server tools
 */
export function verifyMcpTools(
  declaredTools: string[],
  serverTools: McpTool[]
): McpToolResult[] {
  const results: McpToolResult[] = [];
  const serverToolNames = new Set(serverTools.map((t) => t.name));
  const declaredSet = new Set(declaredTools);

  // Check declared tools
  for (const name of declaredTools) {
    const inServer = serverToolNames.has(name);
    results.push({
      name,
      status: inServer ? 'found' : 'missing',
      declared: true,
      inServer,
    });
  }

  // Check for extra tools (in server but not declared)
  for (const tool of serverTools) {
    if (!declaredSet.has(tool.name)) {
      results.push({
        name: tool.name,
        status: 'extra',
        declared: false,
        inServer: true,
      });
    }
  }

  return results;
}

/**
 * Verify MCP tools for a tool
 */
export async function verifyMcpTool(
  toolId: string,
  declaredTools: string[],
  startCommand: string | undefined,
  cwd: string,
  options: McpServerOptions = {}
): Promise<McpVerifyResult> {
  // No start command - skip verification
  if (!startCommand) {
    return {
      tool: toolId,
      type: 'mcp',
      serverStarted: false,
      error: 'No MCP start command configured',
      results: declaredTools.map((name) => ({
        name,
        status: 'missing' as const,
        declared: true,
        inServer: false,
      })),
      summary: {
        found: 0,
        missing: declaredTools.length,
        extra: 0,
        total: declaredTools.length,
      },
    };
  }

  let server: McpServer | null = null;

  try {
    // Start the server
    server = await startMcpServer(startCommand, { ...options, cwd });

    // List tools
    const serverTools = await listMcpTools(server);

    // Compare
    const results = verifyMcpTools(declaredTools, serverTools);

    const found = results.filter((r) => r.status === 'found').length;
    const missing = results.filter((r) => r.status === 'missing').length;
    const extra = results.filter((r) => r.status === 'extra').length;

    return {
      tool: toolId,
      type: 'mcp',
      serverStarted: true,
      results,
      summary: {
        found,
        missing,
        extra,
        total: results.length,
      },
    };
  } catch (err) {
    return {
      tool: toolId,
      type: 'mcp',
      serverStarted: false,
      error: err instanceof Error ? err.message : String(err),
      results: declaredTools.map((name) => ({
        name,
        status: 'missing' as const,
        declared: true,
        inServer: false,
      })),
      summary: {
        found: 0,
        missing: declaredTools.length,
        extra: 0,
        total: declaredTools.length,
      },
    };
  } finally {
    // Clean up server
    if (server) {
      server.close();
    }
  }
}
