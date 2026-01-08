/**
 * verify-output command for pai-deps
 *
 * Validates tool outputs against their declared JSON schemas.
 */

import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import {
  validateAgainstSchema,
  loadContractSchema,
  formatValidationErrors,
  type ValidationError,
} from '../lib/validator.js';
import { getGlobalOptions, error as logError, success, log } from '../lib/output.js';

/**
 * Options for verify-output command
 */
interface VerifyOutputOptions {
  file?: string;
}

/**
 * JSON output format
 */
interface VerifyOutputJsonOutput {
  success: boolean;
  tool?: string | undefined;
  contract?: string | undefined;
  schemaPath?: string | undefined;
  errors?: ValidationError[] | undefined;
  error?: string | undefined;
}

/**
 * Read input from stdin
 */
async function readStdin(): Promise<string> {
  const chunks: string[] = [];

  return new Promise((resolve, reject) => {
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);

    // If stdin is a TTY (no piped input), timeout quickly
    if (process.stdin.isTTY) {
      reject(new Error('No input provided. Use --file or pipe data to stdin.'));
    }
  });
}

/**
 * Register the 'verify-output' command with the program
 */
export function verifyOutputCommand(program: Command): void {
  program
    .command('verify-output <tool> <contract>')
    .description('Validate tool output against its declared JSON schema')
    .option('-f, --file <path>', 'Read output from file instead of stdin')
    .action(async (toolId: string, contractName: string, options: VerifyOutputOptions) => {
      const opts = getGlobalOptions();

      try {
        // Load the contract schema
        const schemaResult = await loadContractSchema(toolId, contractName);

        if (!schemaResult.success || !schemaResult.schema) {
          if (opts.json) {
            const output: VerifyOutputJsonOutput = {
              success: false,
              tool: toolId,
              contract: contractName,
              error: schemaResult.error,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(schemaResult.error || 'Failed to load schema');
          }
          process.exit(1);
        }

        // Read input data
        let inputJson: string;
        try {
          if (options.file) {
            inputJson = await readFile(options.file, 'utf-8');
          } else {
            inputJson = await readStdin();
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (opts.json) {
            const output: VerifyOutputJsonOutput = {
              success: false,
              tool: toolId,
              contract: contractName,
              error: `Failed to read input: ${errorMsg}`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Failed to read input: ${errorMsg}`);
          }
          process.exit(1);
        }

        // Parse input JSON
        let data: unknown;
        try {
          data = JSON.parse(inputJson);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (opts.json) {
            const output: VerifyOutputJsonOutput = {
              success: false,
              tool: toolId,
              contract: contractName,
              error: `Invalid JSON input: ${errorMsg}`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Invalid JSON input: ${errorMsg}`);
          }
          process.exit(1);
        }

        // Validate against schema
        const result = validateAgainstSchema(schemaResult.schema, data);

        if (opts.json) {
          const output: VerifyOutputJsonOutput = {
            success: result.valid,
            tool: toolId,
            contract: contractName,
            schemaPath: schemaResult.schemaPath,
            errors: result.errors,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          if (result.valid) {
            success(`Output valid for ${toolId}:${contractName}`);
            log(`Schema: ${schemaResult.schemaPath}`);
          } else {
            logError(`Validation failed for ${toolId}:${contractName}`);
            log('');
            log('Errors:');
            log(formatValidationErrors(result.errors || []));
            log('');
            log(`Schema: ${schemaResult.schemaPath}`);
          }
        }

        if (!result.valid) {
          process.exit(1);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (opts.json) {
          const output: VerifyOutputJsonOutput = {
            success: false,
            tool: toolId,
            contract: contractName,
            error: errorMsg,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(errorMsg);
        }
        process.exit(1);
      }
    });
}
