/**
 * Register command for pai-deps
 *
 * Registers a tool from its pai-manifest.yaml file into the dependency database.
 */

import type { Command } from 'commander';
import { registerTool, type RegisterResult } from '../lib/registry';
import { ManifestParseError } from '../lib/manifest';
import { output, warn, failure, getGlobalOptions } from '../lib/output';

/**
 * Format human-readable output for registration result
 */
function formatHumanOutput(result: RegisterResult): string {
  const lines: string[] = [];

  const action = result.action === 'updated' ? 'Updated' : 'Registered';
  const version = result.tool.version ? ` v${result.tool.version}` : '';
  lines.push(`${action} ${result.tool.name}${version}`);

  // Dependencies
  const stubCount = result.warnings.filter((w) =>
    w.startsWith('Created stub')
  ).length;
  const depInfo =
    stubCount > 0
      ? `${result.tool.dependencies} (${stubCount} stub${stubCount > 1 ? 's' : ''} created)`
      : `${result.tool.dependencies}`;
  lines.push(`  Dependencies: ${depInfo}`);

  // Provides
  const provides = result.tool.provides;
  const providesParts: string[] = [];
  if (provides.cli) providesParts.push(`${provides.cli} CLI command${provides.cli > 1 ? 's' : ''}`);
  if (provides.mcp) providesParts.push(`${provides.mcp} MCP tool${provides.mcp > 1 ? 's' : ''}`);
  if (provides.library) providesParts.push(`${provides.library} library export${provides.library > 1 ? 's' : ''}`);
  if (provides.database) providesParts.push(`${provides.database} database${provides.database > 1 ? 's' : ''}`);
  if (providesParts.length > 0) {
    lines.push(`  Provides: ${providesParts.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Register the 'register' command with the program
 */
export function registerCommand(program: Command): void {
  program
    .command('register <path>')
    .description('Register a tool from pai-manifest.yaml')
    .action((path: string) => {
      const opts = getGlobalOptions();

      try {
        const result = registerTool(path, opts);

        // Show warnings
        for (const warning of result.warnings) {
          warn(warning);
        }

        // Output result
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatHumanOutput(result));
        }
      } catch (err) {
        if (err instanceof ManifestParseError) {
          if (opts.json) {
            output(failure(err.message, err.filePath ?? undefined));
          } else {
            console.error(`Error: ${err.message}`);
          }
          process.exit(1);
        }

        // Unexpected error
        const message = err instanceof Error ? err.message : String(err);
        if (opts.json) {
          output(failure(message));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });
}
