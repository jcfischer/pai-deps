/**
 * Show command for pai-deps
 *
 * Displays detailed information about a specific tool including
 * dependencies, dependents, and provides.
 */

import type { Command } from 'commander';
import { getDb } from '../db';
import { getGlobalOptions, error as logError } from '../lib/output';
import { getToolById, getToolDependencies, getToolDependents } from '../lib/queries';
import { parseManifest, type ProvidesSection } from '../lib/manifest';
import { formatTree, formatTreeItem } from '../lib/table';

/**
 * JSON output format for show command
 */
interface ShowJsonOutput {
  success: boolean;
  error?: string;
  tool?: {
    id: string;
    name: string;
    version: string | null;
    type: string;
    path: string;
    manifestPath: string | null;
    reliability: number | null;
    debtScore: number | null;
    stub: boolean;
    lastVerified: string | null;
    createdAt: string;
    updatedAt: string;
  };
  dependencies?: Array<{
    name: string;
    type: string;
    version: string | null;
    optional: boolean;
  }>;
  dependents?: string[];
  provides?: ProvidesSection;
}

/**
 * Register the 'show' command with the program
 */
export function showCommand(program: Command): void {
  program
    .command('show <tool>')
    .description('Show details for a tool')
    .action((toolId: string) => {
      const opts = getGlobalOptions();
      const db = getDb();

      // Get tool
      const tool = getToolById(db, toolId);

      if (!tool) {
        if (opts.json) {
          const output: ShowJsonOutput = {
            success: false,
            error: `Tool '${toolId}' not found`,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(`Tool '${toolId}' not found`);
        }
        process.exit(1);
      }

      // Get dependencies (tools this one depends on)
      const deps = getToolDependencies(db, toolId);

      // Get dependents (tools that depend on this one)
      const dependents = getToolDependents(db, toolId);

      // Get provides from manifest if available
      let provides: ProvidesSection | undefined;
      if (tool.manifestPath) {
        try {
          const manifest = parseManifest(tool.manifestPath);
          provides = manifest.provides;
        } catch {
          // Manifest might not exist anymore - silently ignore
        }
      }

      if (opts.json) {
        const output: ShowJsonOutput = {
          success: true,
          tool: {
            id: tool.id,
            name: tool.name,
            version: tool.version,
            type: tool.type,
            path: tool.path,
            manifestPath: tool.manifestPath,
            reliability: tool.reliability,
            debtScore: tool.debtScore,
            stub: tool.stub === 1,
            lastVerified: tool.lastVerified,
            createdAt: tool.createdAt,
            updatedAt: tool.updatedAt,
          },
          dependencies: deps.map((d) => ({
            name: d.providerId,
            type: d.type,
            version: d.versionConstraint,
            optional: d.optional === 1,
          })),
          dependents: dependents.map((d) => d.consumerId),
          provides,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Human-readable output
      console.log(`Tool: ${tool.name}`);
      console.log(`Version: ${tool.version ?? '-'}`);
      console.log(`Type: ${tool.type}`);
      console.log(`Path: ${tool.path}`);
      if (tool.stub === 1) {
        console.log(`Status: [stub]`);
      }
      console.log();

      console.log(`Reliability: ${tool.reliability ?? '-'}`);
      console.log(`Debt Score: ${tool.debtScore ?? '-'}`);
      if (tool.lastVerified) {
        console.log(`Last Verified: ${tool.lastVerified}`);
      }

      // Dependencies
      if (deps.length > 0) {
        console.log();
        console.log(`Dependencies (${deps.length}):`);
        const depItems = deps.map((d) => {
          const meta = `(${d.type})${d.versionConstraint ? ` ${d.versionConstraint}` : ''}`;
          return formatTreeItem(d.providerId, meta);
        });
        console.log(formatTree(depItems, 2));
      }

      // Dependents
      if (dependents.length > 0) {
        console.log();
        console.log(`Depended on by (${dependents.length}):`);
        const depItems = dependents.map((d) => d.consumerId);
        console.log(formatTree(depItems, 2));
      }

      // Provides
      if (provides) {
        const hasCli = provides.cli && provides.cli.length > 0;
        const hasMcp = provides.mcp && provides.mcp.length > 0;
        const hasLibrary = provides.library && provides.library.length > 0;
        const hasDatabase = provides.database && provides.database.length > 0;

        if (hasCli || hasMcp || hasLibrary || hasDatabase) {
          console.log();
          console.log('Provides:');

          if (hasCli && provides.cli) {
            console.log('  CLI Commands:');
            const cliItems = provides.cli.map((c) => c.command);
            console.log(formatTree(cliItems, 4));
          }

          if (hasMcp && provides.mcp) {
            console.log('  MCP Tools:');
            const mcpItems = provides.mcp.map((m) => {
              if ('tool' in m) return m.tool;
              if ('resource' in m) return `[resource] ${m.resource}`;
              return 'unknown';
            });
            console.log(formatTree(mcpItems, 4));
          }

          if (hasLibrary && provides.library) {
            console.log('  Library Exports:');
            const libItems = provides.library.map((l) => l.export);
            console.log(formatTree(libItems, 4));
          }

          if (hasDatabase && provides.database) {
            console.log('  Databases:');
            const dbItems = provides.database.map((d) => d.path);
            console.log(formatTree(dbItems, 4));
          }
        }
      }
    });
}
