/**
 * Verify command for pai-deps
 *
 * Verifies that CLI commands declared in manifests actually exist.
 */

import type { Command } from 'commander';
import { getDb, tools } from '../db/index.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';
import { verifyTool, type ToolVerifyResult, type VerifyOptions } from '../lib/verifier.js';

/**
 * Options for verify command
 */
interface VerifyCommandOptions {
  all?: boolean;
  quick?: boolean;
  timeout?: string;
}

/**
 * JSON output format
 */
interface VerifyJsonOutput {
  success: boolean;
  error?: string;
  results?: ToolVerifyResult[];
  summary?: {
    tools: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Format a single verification result for display
 */
function formatResult(result: ToolVerifyResult): string {
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
 * Register the 'verify' command with the program
 */
export function verifyCommand(program: Command): void {
  program
    .command('verify [tool]')
    .description('Verify CLI contracts against actual implementations')
    .option('-a, --all', 'Verify all registered tools')
    .option('--quick', 'Only check command existence (skip help check)')
    .option('--timeout <ms>', 'Timeout per command in milliseconds', '5000')
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
        const results: ToolVerifyResult[] = [];
        let totalPassed = 0;
        let totalFailed = 0;
        let totalSkipped = 0;

        for (const tool of toolsToVerify) {
          const result = await verifyTool(
            tool.id,
            tool.path,
            tool.type,
            verifyOpts
          );
          results.push(result);
          totalPassed += result.summary.passed;
          totalFailed += result.summary.failed;
          totalSkipped += result.summary.skipped;

          // Print progress for non-JSON output
          if (!opts.json) {
            console.log(formatResult(result));
            console.log('');
          }
        }

        // JSON output
        if (opts.json) {
          const output: VerifyJsonOutput = {
            success: totalFailed === 0,
            results,
            summary: {
              tools: toolsToVerify.length,
              passed: totalPassed,
              failed: totalFailed,
              skipped: totalSkipped,
            },
          };
          console.log(JSON.stringify(output, null, 2));
        } else if (toolsToVerify.length > 1) {
          // Print overall summary for multiple tools
          console.log('═'.repeat(50));
          console.log(
            `Overall: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped across ${toolsToVerify.length} tools`
          );
        }

        // Exit with error if any failures
        if (totalFailed > 0) {
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
