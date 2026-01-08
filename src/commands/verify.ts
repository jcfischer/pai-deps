/**
 * Verify command for pai-deps
 *
 * Verifies that CLI commands and MCP tools declared in manifests actually exist.
 */

import type { Command } from 'commander';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { eq } from 'drizzle-orm';
import { getDb, tools, toolVerifications } from '../db/index.js';
import { getGlobalOptions, error as logError, warn } from '../lib/output.js';
import { verifyTool, type ToolVerifyResult, type VerifyOptions } from '../lib/verifier.js';
import { verifyMcpTool, type McpVerifyResult } from '../lib/mcp-verifier.js';
import { parseManifest } from '../lib/manifest.js';

/**
 * Get current git commit hash (short form)
 */
function getGitCommit(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Options for verify command
 */
interface VerifyCommandOptions {
  all?: boolean;
  quick?: boolean;
  timeout?: string;
  mcpOnly?: boolean;
  cliOnly?: boolean;
  noSave?: boolean;
}

/**
 * Combined verification result
 */
interface CombinedVerifyResult {
  cli?: ToolVerifyResult;
  mcp?: McpVerifyResult;
}

/**
 * JSON output format
 */
interface VerifyJsonOutput {
  success: boolean;
  error?: string | undefined;
  cli?: {
    results: ToolVerifyResult[];
    summary: {
      tools: number;
      passed: number;
      failed: number;
      skipped: number;
    };
  };
  mcp?: {
    results: McpVerifyResult[];
    summary: {
      tools: number;
      found: number;
      missing: number;
      extra: number;
    };
  };
}

/**
 * Format CLI verification result for display
 */
function formatCliResult(result: ToolVerifyResult): string {
  const lines: string[] = [];

  lines.push(`Verifying CLI contracts for: ${result.tool} (${result.type})`);
  lines.push('');

  for (const r of result.results) {
    const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '○';
    const status =
      r.status === 'pass'
        ? 'OK'
        : r.status === 'fail'
          ? r.error || 'Failed'
          : 'Skipped';
    const duration = r.duration > 0 ? ` (${r.duration}ms)` : '';

    lines.push(`  ${icon} ${r.command.padEnd(30)} ${status}${duration}`);
  }

  lines.push('');
  lines.push(
    `Results: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`
  );

  return lines.join('\n');
}

/**
 * Format MCP verification result for display
 */
function formatMcpResult(result: McpVerifyResult): string {
  const lines: string[] = [];

  lines.push(`Verifying MCP contracts for: ${result.tool}`);

  if (result.error) {
    lines.push(`  ⚠ Error: ${result.error}`);
    return lines.join('\n');
  }

  lines.push('');

  for (const r of result.results) {
    const icon = r.status === 'found' ? '✓' : r.status === 'missing' ? '✗' : '+';
    const status =
      r.status === 'found'
        ? 'Found in server'
        : r.status === 'missing'
          ? 'Not found in server'
          : 'Extra (not declared)';

    lines.push(`  ${icon} ${r.name.padEnd(30)} ${status}`);
  }

  lines.push('');
  lines.push(
    `Results: ${result.summary.found} found, ${result.summary.missing} missing, ${result.summary.extra} extra`
  );

  return lines.join('\n');
}

/**
 * Get MCP tools from a manifest
 */
async function getMcpToolsFromManifest(
  toolPath: string
): Promise<{ tools: string[]; startCommand?: string } | null> {
  const manifestPath = join(toolPath, 'pai-manifest.yaml');

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const manifest = await parseManifest(manifestPath);

    const mcpTools: string[] = [];
    if (manifest.provides?.mcp) {
      for (const mcp of manifest.provides.mcp) {
        if ('tool' in mcp) {
          mcpTools.push(mcp.tool);
        }
      }
    }

    return {
      tools: mcpTools,
      ...(manifest.mcp_start !== undefined && { startCommand: manifest.mcp_start }),
    };
  } catch {
    return null;
  }
}

/**
 * Register the 'verify' command with the program
 */
export function verifyCommand(program: Command): void {
  program
    .command('verify [tool]')
    .description('Verify CLI and MCP contracts against actual implementations')
    .option('-a, --all', 'Verify all registered tools')
    .option('--quick', 'Only check command existence (skip help check)')
    .option('--timeout <ms>', 'Timeout per command in milliseconds', '5000')
    .option('--mcp-only', 'Only verify MCP tools (skip CLI)')
    .option('--cli-only', 'Only verify CLI commands (skip MCP)')
    .option('--no-save', 'Do not save verification results to history')
    .action(async (toolId: string | undefined, options: VerifyCommandOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        const verifyOpts: VerifyOptions = {
          quick: options.quick ?? false,
          timeout: options.timeout ? parseInt(options.timeout, 10) : 5000,
        };

        let toolsToVerify: Array<{ id: string; path: string; type: string }> = [];

        if (options.all) {
          // Get all non-stub tools
          const allTools = db.select().from(tools).all();
          toolsToVerify = allTools
            .filter((t) => !t.stub)
            .map((t) => ({ id: t.id, path: t.path, type: t.type }));
        } else if (toolId) {
          // Get specific tool
          const allTools = db.select().from(tools).all();
          const tool = allTools.find((t) => t.id === toolId);

          if (!tool) {
            if (opts.json) {
              const output: VerifyJsonOutput = {
                success: false,
                error: `Tool '${toolId}' not found`,
              };
              console.log(JSON.stringify(output, null, 2));
            } else {
              logError(`Tool '${toolId}' not found`);
            }
            process.exit(1);
          }

          toolsToVerify = [{ id: tool.id, path: tool.path, type: tool.type }];
        } else {
          if (opts.json) {
            const output: VerifyJsonOutput = {
              success: false,
              error: 'Specify a tool ID or use --all',
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError('Specify a tool ID or use --all');
          }
          process.exit(1);
        }

        // Verify all tools
        const cliResults: ToolVerifyResult[] = [];
        const mcpResults: McpVerifyResult[] = [];
        let totalCliPassed = 0;
        let totalCliFailed = 0;
        let totalCliSkipped = 0;
        let totalMcpFound = 0;
        let totalMcpMissing = 0;
        let totalMcpExtra = 0;

        for (const tool of toolsToVerify) {
          const combined: CombinedVerifyResult = {};

          // CLI verification
          if (!options.mcpOnly) {
            const cliResult = await verifyTool(
              tool.id,
              tool.path,
              tool.type,
              verifyOpts
            );
            combined.cli = cliResult;
            cliResults.push(cliResult);
            totalCliPassed += cliResult.summary.passed;
            totalCliFailed += cliResult.summary.failed;
            totalCliSkipped += cliResult.summary.skipped;

            if (!opts.json) {
              console.log(formatCliResult(cliResult));
              console.log('');
            }
          }

          // MCP verification
          if (!options.cliOnly) {
            const mcpInfo = await getMcpToolsFromManifest(tool.path);

            if (mcpInfo && mcpInfo.tools.length > 0) {
              if (!mcpInfo.startCommand) {
                if (!opts.json) {
                  warn(`No mcp_start command configured for ${tool.id}, skipping MCP verification`);
                }
                const skipResult: McpVerifyResult = {
                  tool: tool.id,
                  type: 'mcp',
                  serverStarted: false,
                  error: 'No mcp_start command configured in manifest',
                  results: mcpInfo.tools.map((name) => ({
                    name,
                    status: 'missing' as const,
                    declared: true,
                    inServer: false,
                  })),
                  summary: {
                    found: 0,
                    missing: mcpInfo.tools.length,
                    extra: 0,
                    total: mcpInfo.tools.length,
                  },
                };
                combined.mcp = skipResult;
                mcpResults.push(skipResult);
                totalMcpMissing += skipResult.summary.missing;
              } else {
                const mcpResult = await verifyMcpTool(
                  tool.id,
                  mcpInfo.tools,
                  mcpInfo.startCommand,
                  tool.path,
                  verifyOpts.timeout !== undefined ? { timeout: verifyOpts.timeout } : {}
                );
                combined.mcp = mcpResult;
                mcpResults.push(mcpResult);
                totalMcpFound += mcpResult.summary.found;
                totalMcpMissing += mcpResult.summary.missing;
                totalMcpExtra += mcpResult.summary.extra;

                if (!opts.json) {
                  console.log(formatMcpResult(mcpResult));
                  console.log('');
                }
              }
            }
          }

          // Store verification result (unless --no-save)
          if (!options.noSave) {
            const now = new Date().toISOString();
            const gitCommit = getGitCommit();

            // Determine overall status
            const cliFailed = combined.cli?.summary.failed ?? 0;
            const mcpMissing = combined.mcp?.summary.missing ?? 0;
            const overallStatus = cliFailed > 0 || mcpMissing > 0 ? 'fail' : 'pass';

            // Insert verification record
            db.insert(toolVerifications).values({
              toolId: tool.id,
              verifiedAt: now,
              cliStatus: combined.cli ? (combined.cli.summary.failed > 0 ? 'fail' : 'pass') : null,
              cliPassed: combined.cli?.summary.passed ?? null,
              cliFailed: combined.cli?.summary.failed ?? null,
              cliSkipped: combined.cli?.summary.skipped ?? null,
              mcpStatus: combined.mcp ? (combined.mcp.summary.missing > 0 ? 'fail' : 'pass') : null,
              mcpFound: combined.mcp?.summary.found ?? null,
              mcpMissing: combined.mcp?.summary.missing ?? null,
              mcpExtra: combined.mcp?.summary.extra ?? null,
              overallStatus,
              gitCommit,
            }).run();

            // Update tool's lastVerified timestamp
            db.update(tools)
              .set({ lastVerified: now, updatedAt: now })
              .where(eq(tools.id, tool.id))
              .run();
          }
        }

        // JSON output
        if (opts.json) {
          const hasMcpFailures = totalMcpMissing > 0;
          const hasCliFailures = totalCliFailed > 0;

          const output: VerifyJsonOutput = {
            success: !hasMcpFailures && !hasCliFailures,
          };

          if (!options.mcpOnly && cliResults.length > 0) {
            output.cli = {
              results: cliResults,
              summary: {
                tools: cliResults.length,
                passed: totalCliPassed,
                failed: totalCliFailed,
                skipped: totalCliSkipped,
              },
            };
          }

          if (!options.cliOnly && mcpResults.length > 0) {
            output.mcp = {
              results: mcpResults,
              summary: {
                tools: mcpResults.length,
                found: totalMcpFound,
                missing: totalMcpMissing,
                extra: totalMcpExtra,
              },
            };
          }

          console.log(JSON.stringify(output, null, 2));
        } else if (toolsToVerify.length > 1) {
          // Print overall summary for multiple tools
          console.log('═'.repeat(50));
          if (!options.mcpOnly) {
            console.log(
              `CLI: ${totalCliPassed} passed, ${totalCliFailed} failed, ${totalCliSkipped} skipped`
            );
          }
          if (!options.cliOnly && mcpResults.length > 0) {
            console.log(
              `MCP: ${totalMcpFound} found, ${totalMcpMissing} missing, ${totalMcpExtra} extra`
            );
          }
        }

        // Exit with error if any failures
        if (totalCliFailed > 0 || totalMcpMissing > 0) {
          process.exit(1);
        }
      } catch (err) {
        if (opts.json) {
          const output: VerifyJsonOutput = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(err instanceof Error ? err.message : String(err));
        }
        process.exit(1);
      }
    });
}
