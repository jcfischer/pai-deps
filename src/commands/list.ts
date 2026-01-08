/**
 * List command for pai-deps
 *
 * Lists all registered tools in ASCII table format with filtering options.
 */

import type { Command } from 'commander';
import { getDb } from '../db';
import { tools } from '../db/schema';
import { getGlobalOptions, log } from '../lib/output';
import { formatTable } from '../lib/table';
import { countDependencies } from '../lib/queries';

/**
 * List command options
 */
interface ListOptions {
  type?: string;
  stubs?: boolean;
}

/**
 * Tool data for JSON output
 */
interface ListToolData {
  id: string;
  type: string;
  version: string | null;
  dependencies: number;
  reliability: number | null;
  debtScore: number | null;
  stub: boolean;
}

/**
 * JSON output format for list command
 */
interface ListJsonOutput {
  success: boolean;
  tools: ListToolData[];
  total: number;
  stubs: number;
}

/**
 * Register the 'list' command with the program
 */
export function listCommand(program: Command): void {
  program
    .command('list')
    .description('List all registered tools')
    .option('--type <type>', 'Filter by tool type (cli, mcp, library, workflow, hook)')
    .option('--stubs', 'Show only stub entries')
    .option('--no-stubs', 'Hide stub entries')
    .action((options: ListOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      // Build query - get all tools first, then filter in JS for cleaner logic
      let allTools = db.select().from(tools).orderBy(tools.name).all();

      // Apply type filter
      if (options.type) {
        allTools = allTools.filter((t) => t.type === options.type);
      }

      // Apply stub filter
      // Commander parses --stubs as true and --no-stubs as false
      if (options.stubs === true) {
        allTools = allTools.filter((t) => t.stub === 1);
      } else if (options.stubs === false) {
        allTools = allTools.filter((t) => t.stub === 0);
      }

      // Count dependencies for each tool
      const toolsWithDeps = allTools.map((t) => ({
        ...t,
        depCount: countDependencies(db, t.id),
      }));

      // Calculate stub count for footer
      const stubCount = toolsWithDeps.filter((t) => t.stub === 1).length;

      if (opts.json) {
        const output: ListJsonOutput = {
          success: true,
          tools: toolsWithDeps.map((t) => ({
            id: t.id,
            type: t.type,
            version: t.version,
            dependencies: t.depCount,
            reliability: t.reliability,
            debtScore: t.debtScore,
            stub: t.stub === 1,
          })),
          total: toolsWithDeps.length,
          stubs: stubCount,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Human-readable output
      if (toolsWithDeps.length === 0) {
        log('No tools registered');
        return;
      }

      // Format as table
      const headers = ['ID', 'Type', 'Version', 'Deps', 'Reliability', 'Debt', 'Status'];
      const rows = toolsWithDeps.map((t) => [
        t.id,
        t.type,
        t.version ?? '-',
        t.depCount.toString(),
        t.reliability?.toFixed(2) ?? '-',
        t.debtScore?.toString() ?? '-',
        t.stub === 1 ? '[stub]' : '\u25CF', // ● character
      ]);

      console.log(formatTable(headers, rows));
      console.log();
      console.log(`${toolsWithDeps.length} tools (${stubCount} stubs)`);
    });
}
