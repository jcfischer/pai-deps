/**
 * Drift command for pai-deps
 *
 * Detects schema drift in tool contracts by comparing
 * stored hashes with current schema file hashes.
 */

import type { Command } from 'commander';
import { join, isAbsolute } from 'node:path';
import { getDb } from '../db/index.js';
import { tools, contracts } from '../db/schema.js';
import { hashSchemaFile, compareHashes } from '../lib/hasher.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';
import { eq } from 'drizzle-orm';

/**
 * Options for drift command
 */
interface DriftOptions {
  all?: boolean;
  update?: boolean;
}

/**
 * Result for a single contract drift check
 */
interface ContractDriftResult {
  contract: string;
  contractType: string;
  status: 'unchanged' | 'drift' | 'new' | 'missing' | 'error';
  storedHash?: string;
  currentHash?: string;
  changes?: { added: string[]; removed: string[] };
  error?: string;
}

/**
 * JSON output format
 */
interface DriftJsonOutput {
  success: boolean;
  tool?: string;
  results?: ContractDriftResult[];
  summary?: {
    unchanged: number;
    drifted: number;
    new: number;
    missing: number;
    errors: number;
    total: number;
  };
  error?: string;
}

/**
 * Status indicators for human-readable output
 */
const STATUS_ICONS: Record<string, string> = {
  unchanged: '✓',
  drift: '⚠',
  new: '+',
  missing: '✗',
  error: '!',
};

/**
 * Check drift for a single tool's contracts
 */
async function checkToolDrift(
  toolId: string,
  toolPath: string,
  update: boolean
): Promise<ContractDriftResult[]> {
  const db = getDb();
  const results: ContractDriftResult[] = [];

  // Get contracts for this tool - using JS filter due to drizzle eq() issues
  const allContracts = db.select().from(contracts).all();
  const toolContracts = allContracts.filter((c) => c.toolId === toolId);

  if (toolContracts.length === 0) {
    return [];
  }

  for (const contract of toolContracts) {
    // Skip contracts without schema paths
    if (!contract.schemaPath) {
      results.push({
        contract: contract.name,
        contractType: contract.contractType,
        status: 'error',
        error: 'No schema_path defined',
      });
      continue;
    }

    // Resolve schema path relative to tool path
    const schemaPath = isAbsolute(contract.schemaPath)
      ? contract.schemaPath
      : join(toolPath, contract.schemaPath);

    // Hash the schema file
    const hashResult = await hashSchemaFile(schemaPath);
    const currentHash = hashResult?.hash ?? null;

    // Compare with stored hash
    const comparison = compareHashes(contract.schemaHash, currentHash);

    const result: ContractDriftResult = {
      contract: contract.name,
      contractType: contract.contractType,
      status: comparison.status,
    };

    // Only set hash fields if they have values
    if (comparison.storedHash) {
      result.storedHash = comparison.storedHash;
    }
    if (comparison.currentHash) {
      result.currentHash = comparison.currentHash;
    }

    if (comparison.error) {
      result.error = comparison.error;
    }

    results.push(result);

    // Update hash if requested and we have a current hash
    if (update && currentHash) {
      const now = new Date().toISOString();
      db.update(contracts)
        .set({
          schemaHash: currentHash,
          lastVerified: now,
          status: 'valid',
        })
        .where(eq(contracts.id, contract.id))
        .run();
    }
  }

  return results;
}

/**
 * Register the 'drift' command with the program
 */
export function driftCommand(program: Command): void {
  program
    .command('drift [tool]')
    .description('Check for schema drift in tool contracts')
    .option('-a, --all', 'Check all tools with contracts')
    .option('-u, --update', 'Update stored hashes after review')
    .action(async (toolId: string | undefined, options: DriftOptions) => {
      const opts = getGlobalOptions();
      const db = getDb();

      // Validate options
      if (!toolId && !options.all) {
        if (opts.json) {
          const output: DriftJsonOutput = {
            success: false,
            error: 'Specify a tool ID or use --all',
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError('Specify a tool ID or use --all');
        }
        process.exit(1);
      }

      try {
        // Get tools to check
        const allTools = db.select().from(tools).all();
        let toolsToCheck: Array<{ id: string; path: string }> = [];

        if (options.all) {
          toolsToCheck = allTools
            .filter((t) => !t.stub)
            .map((t) => ({ id: t.id, path: t.path }));
        } else if (toolId) {
          const tool = allTools.find((t) => t.id === toolId);
          if (!tool) {
            if (opts.json) {
              const output: DriftJsonOutput = {
                success: false,
                error: `Tool '${toolId}' not found`,
              };
              console.log(JSON.stringify(output, null, 2));
            } else {
              logError(`Tool '${toolId}' not found`);
            }
            process.exit(1);
          }
          toolsToCheck = [{ id: tool.id, path: tool.path }];
        }

        // Check drift for each tool
        const allResults: Map<string, ContractDriftResult[]> = new Map();
        let totalUnchanged = 0;
        let totalDrifted = 0;
        let totalNew = 0;
        let totalMissing = 0;
        let totalErrors = 0;
        let totalContracts = 0;

        for (const tool of toolsToCheck) {
          const results = await checkToolDrift(tool.id, tool.path, options.update ?? false);
          if (results.length > 0) {
            allResults.set(tool.id, results);
            for (const r of results) {
              totalContracts++;
              switch (r.status) {
                case 'unchanged':
                  totalUnchanged++;
                  break;
                case 'drift':
                  totalDrifted++;
                  break;
                case 'new':
                  totalNew++;
                  break;
                case 'missing':
                  totalMissing++;
                  break;
                case 'error':
                  totalErrors++;
                  break;
              }
            }
          }
        }

        // JSON output
        if (opts.json) {
          const resultsArray: { tool: string; contracts: ContractDriftResult[] }[] = [];
          for (const [tid, results] of allResults) {
            resultsArray.push({ tool: tid, contracts: results });
          }

          const output: DriftJsonOutput & { tools?: typeof resultsArray } = {
            success: totalDrifted === 0 && totalMissing === 0 && totalErrors === 0,
            tools: resultsArray,
            summary: {
              unchanged: totalUnchanged,
              drifted: totalDrifted,
              new: totalNew,
              missing: totalMissing,
              errors: totalErrors,
              total: totalContracts,
            },
          };
          console.log(JSON.stringify(output, null, 2));

          // Exit with error if drift detected
          if (totalDrifted > 0 || totalMissing > 0) {
            process.exit(1);
          }
          return;
        }

        // Human-readable output
        if (allResults.size === 0) {
          console.log('No contracts with schemas found.');
          return;
        }

        for (const [tid, results] of allResults) {
          console.log(`\nChecking schema drift for: ${tid}`);
          console.log();

          for (const r of results) {
            const icon = STATUS_ICONS[r.status] || '?';
            const name = r.contract.padEnd(30);

            let detail = '';
            switch (r.status) {
              case 'unchanged':
                detail = 'No drift (hash unchanged)';
                break;
              case 'drift':
                detail = `Drift detected`;
                if (r.storedHash && r.currentHash) {
                  detail += `\n     Hash: ${r.storedHash.slice(0, 8)} → ${r.currentHash.slice(0, 8)}`;
                }
                break;
              case 'new':
                detail = 'New contract (no stored hash)';
                break;
              case 'missing':
                detail = 'Schema file not found';
                break;
              case 'error':
                detail = r.error || 'Unknown error';
                break;
            }

            console.log(`  ${icon} ${name} ${detail}`);
          }
        }

        // Summary
        console.log();
        const summaryParts: string[] = [];
        if (totalUnchanged > 0) summaryParts.push(`${totalUnchanged} unchanged`);
        if (totalDrifted > 0) summaryParts.push(`${totalDrifted} drifted`);
        if (totalNew > 0) summaryParts.push(`${totalNew} new`);
        if (totalMissing > 0) summaryParts.push(`${totalMissing} missing`);
        if (totalErrors > 0) summaryParts.push(`${totalErrors} errors`);
        console.log(`Results: ${summaryParts.join(', ')}`);

        if (options.update && (totalDrifted > 0 || totalNew > 0)) {
          console.log('\nHashes updated.');
        }

        // Exit with error if drift detected
        if (totalDrifted > 0 || totalMissing > 0) {
          process.exit(1);
        }
      } catch (err) {
        if (opts.json) {
          const output: DriftJsonOutput = {
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
