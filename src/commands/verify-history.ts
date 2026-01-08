/**
 * Verify History command for pai-deps
 *
 * Shows verification history for a tool.
 */

import type { Command } from 'commander';
import { desc, eq } from 'drizzle-orm';
import { getDb, tools, toolVerifications } from '../db/index.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';
import { formatTable } from '../lib/table.js';

/**
 * Options for verify-history command
 */
interface VerifyHistoryOptions {
  limit?: string;
}

/**
 * Verification history record for display
 */
interface VerifyHistoryRecord {
  id: number;
  verifiedAt: string;
  overallStatus: string;
  cliStatus: string | null;
  cliPassed: number | null;
  cliFailed: number | null;
  mcpStatus: string | null;
  mcpFound: number | null;
  mcpMissing: number | null;
  gitCommit: string | null;
}

/**
 * JSON output format
 */
interface VerifyHistoryJsonOutput {
  success: boolean;
  error?: string | undefined;
  tool?: string | undefined;
  history?: VerifyHistoryRecord[] | undefined;
  count?: number | undefined;
}

/**
 * Format date for display (compact form)
 */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${mins}`;
}

/**
 * Register the 'verify-history' command with the program
 */
export function verifyHistoryCommand(program: Command): void {
  program
    .command('verify-history <tool>')
    .description('Show verification history for a tool')
    .option('-l, --limit <n>', 'Maximum number of records to show', '20')
    .action(async (toolId: string, options: VerifyHistoryOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        // Check if tool exists
        const allTools = db.select().from(tools).all();
        const tool = allTools.find((t) => t.id === toolId);

        if (!tool) {
          if (opts.json) {
            const output: VerifyHistoryJsonOutput = {
              success: false,
              error: `Tool '${toolId}' not found`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Tool '${toolId}' not found`);
          }
          process.exit(1);
        }

        const limit = options.limit ? parseInt(options.limit, 10) : 20;

        // Get verification history
        const history = db
          .select()
          .from(toolVerifications)
          .where(eq(toolVerifications.toolId, toolId))
          .orderBy(desc(toolVerifications.verifiedAt))
          .limit(limit)
          .all();

        // JSON output
        if (opts.json) {
          const output: VerifyHistoryJsonOutput = {
            success: true,
            tool: toolId,
            history: history.map((h) => ({
              id: h.id,
              verifiedAt: h.verifiedAt,
              overallStatus: h.overallStatus,
              cliStatus: h.cliStatus,
              cliPassed: h.cliPassed,
              cliFailed: h.cliFailed,
              mcpStatus: h.mcpStatus,
              mcpFound: h.mcpFound,
              mcpMissing: h.mcpMissing,
              gitCommit: h.gitCommit,
            })),
            count: history.length,
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Human-readable output
        if (history.length === 0) {
          console.log(`No verification history for '${toolId}'.`);
          console.log(`Run 'pai-deps verify ${toolId}' to create verification records.`);
          return;
        }

        console.log(`Verification history for: ${toolId} (${tool.name})`);
        console.log();

        // Build table
        const headers = ['Date', 'Status', 'CLI', 'MCP', 'Commit'];
        const rows = history.map((h) => {
          const cliSummary = h.cliPassed !== null
            ? `${h.cliPassed}✓ ${h.cliFailed}✗`
            : '-';
          const mcpSummary = h.mcpFound !== null
            ? `${h.mcpFound}✓ ${h.mcpMissing}✗`
            : '-';
          const status = h.overallStatus === 'pass' ? '✓ pass' : '✗ fail';
          return [
            formatDate(h.verifiedAt),
            status,
            cliSummary,
            mcpSummary,
            h.gitCommit ?? '-',
          ];
        });

        console.log(formatTable(headers, rows));
        console.log();
        console.log(`Showing ${history.length} most recent verifications.`);

        // Show last verified from tool record
        if (tool.lastVerified) {
          console.log(`Last verified: ${tool.lastVerified}`);
        }
      } catch (err) {
        if (opts.json) {
          const output: VerifyHistoryJsonOutput = {
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
