/**
 * Unregister command for pai-deps
 *
 * Removes a tool from the registry, with safety checks for dependents.
 */

import type { Command } from 'commander';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { tools } from '../db/schema';
import { getGlobalOptions, error as logError, log, warn } from '../lib/output';
import { getToolById, getToolDependents } from '../lib/queries';

/**
 * Unregister command options
 */
interface UnregisterOptions {
  force?: boolean;
}

/**
 * JSON output format for unregister command
 */
interface UnregisterJsonOutput {
  success: boolean;
  error?: string;
  hint?: string;
  dependents?: string[];
  action?: 'unregistered';
  tool?: string;
  affectedDependents?: string[];
}

/**
 * Register the 'unregister' command with the program
 */
export function unregisterCommand(program: Command): void {
  program
    .command('unregister <tool>')
    .description('Remove a tool from the registry')
    .option('--force', 'Force removal even if other tools depend on it')
    .action((toolId: string, options: UnregisterOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      // Check if tool exists
      const tool = getToolById(db, toolId);

      if (!tool) {
        if (opts.json) {
          const output: UnregisterJsonOutput = {
            success: false,
            error: `Tool '${toolId}' not found`,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(`Tool '${toolId}' not found`);
        }
        process.exit(1);
      }

      // Check for dependents
      const dependents = getToolDependents(db, toolId);
      const dependentIds = dependents.map((d) => d.consumerId);

      if (dependents.length > 0 && !options.force) {
        if (opts.json) {
          const output: UnregisterJsonOutput = {
            success: false,
            error: 'Tool has dependents',
            dependents: dependentIds,
            hint: 'Use --force to remove anyway',
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(`Cannot unregister '${toolId}': the following tools depend on it:`);
          for (const id of dependentIds) {
            console.error(`  - ${id}`);
          }
          console.error('Use --force to remove anyway.');
        }
        process.exit(1);
      }

      // Delete tool (CASCADE handles consumer dependencies)
      db.delete(tools).where(eq(tools.id, toolId)).run();

      if (opts.json) {
        const output: UnregisterJsonOutput = {
          success: true,
          action: 'unregistered',
          tool: toolId,
          affectedDependents: dependentIds,
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        log(`Unregistered ${toolId}`);
        if (dependents.length > 0) {
          warn(`${dependents.length} tools still reference this tool`);
        }
      }
    });
}
