/**
 * Init command for pai-deps
 *
 * Generates a pai-manifest.yaml template file from package.json detection.
 */

import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { detectFromPackageJson, generateManifestTemplate, type AnalysisData } from '../lib/detector';
import { analyzeProject, type AnalysisResult } from '../lib/analyzer';
import { getGlobalOptions, error as logError } from '../lib/output';

/**
 * Result of the init command
 */
interface InitResult {
  success: boolean;
  action: 'created' | 'preview' | 'error';
  path: string;
  manifest: {
    name: string;
    type: string;
    version: string;
  };
  analysis?: {
    commands_detected: number;
    dependencies_detected: number;
    mcp_tools_detected: number;
    type_detected: string;
  } | undefined;
  error?: string | undefined;
}

/**
 * Register the 'init' command with the program
 */
export function initCommand(program: Command): void {
  program
    .command('init <path>')
    .description('Generate a pai-manifest.yaml template')
    .option('--force', 'Overwrite existing manifest')
    .option('--name <name>', 'Override detected name')
    .option('--type <type>', 'Override detected type (cli, mcp, library)')
    .option('-a, --analyze', 'Analyze source code to detect provides/depends_on')
    .option('--dry-run', 'Show what would be generated without writing')
    .action(async (inputPath: string, options: { force?: boolean; name?: string; type?: string; analyze?: boolean; dryRun?: boolean }) => {
      const globalOpts = getGlobalOptions();
      const targetDir = resolve(inputPath);
      const manifestPath = join(targetDir, 'pai-manifest.yaml');

      // Check if directory exists
      if (!existsSync(targetDir)) {
        const errorMsg = `Directory not found: ${targetDir}`;
        if (globalOpts.json) {
          console.log(JSON.stringify({
            success: false,
            error: errorMsg,
          }, null, 2));
        } else {
          logError(errorMsg);
        }
        process.exit(1);
      }

      // Check existing manifest
      if (existsSync(manifestPath) && !options.force) {
        const errorMsg = 'pai-manifest.yaml already exists. Use --force to overwrite.';
        if (globalOpts.json) {
          console.log(JSON.stringify({
            success: false,
            error: errorMsg,
          }, null, 2));
        } else {
          logError('pai-manifest.yaml already exists');
          console.error('Use --force to overwrite.');
        }
        process.exit(1);
      }

      // Detect from package.json
      const detected = await detectFromPackageJson(targetDir);

      // Apply overrides and defaults
      const manifest = {
        name: options.name || detected.name || basename(targetDir),
        version: detected.version || '0.1.0',
        type: options.type || detected.type || 'cli',
        description: detected.description || '',
      };

      // Run analysis if requested
      let analysisData: AnalysisData | null = null;
      let analysisResult: AnalysisResult | null = null;

      if (options.analyze) {
        analysisResult = await analyzeProject(targetDir);

        // Show warnings in non-JSON mode
        if (!globalOpts.json) {
          for (const warning of analysisResult.warnings) {
            console.warn(`Warning: ${warning}`);
          }
        }

        // Convert to AnalysisData format
        if (analysisResult.cliCommands.length > 0 ||
            analysisResult.dependencies.length > 0 ||
            analysisResult.mcpTools.length > 0) {
          analysisData = {
            cliCommands: analysisResult.cliCommands,
            dependencies: analysisResult.dependencies.map(d => ({
              name: d.name,
              type: d.type,
            })),
            mcpTools: analysisResult.mcpTools,
          };

          // Auto-detect MCP type if MCP tools found
          if (analysisResult.mcpTools.length > 0 && !options.type) {
            manifest.type = 'mcp';
          }
        }
      }

      // Generate template
      const template = generateManifestTemplate(manifest, analysisData);

      // Handle dry-run
      if (options.dryRun) {
        if (globalOpts.json) {
          const result: InitResult = {
            success: true,
            action: 'preview',
            path: manifestPath,
            manifest: {
              name: manifest.name,
              type: manifest.type,
              version: manifest.version,
            },
            analysis: analysisResult ? {
              commands_detected: analysisResult.cliCommands.length,
              dependencies_detected: analysisResult.dependencies.length,
              mcp_tools_detected: analysisResult.mcpTools.length,
              type_detected: manifest.type,
            } : undefined,
          };
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('=== Manifest Preview (dry run) ===\n');
          console.log(template);
          if (analysisResult) {
            console.log('Analysis summary:');
            console.log(`  Commands detected: ${analysisResult.cliCommands.length}`);
            console.log(`  Dependencies detected: ${analysisResult.dependencies.length}`);
            console.log(`  MCP tools detected: ${analysisResult.mcpTools.length}`);
          }
          console.log('\n[Dry run - no file written]');
        }
        return;
      }

      // Write file
      try {
        await Bun.write(manifestPath, template);
      } catch (err) {
        const errorMsg = `Failed to write manifest: ${err instanceof Error ? err.message : String(err)}`;
        if (globalOpts.json) {
          console.log(JSON.stringify({
            success: false,
            error: errorMsg,
          }, null, 2));
        } else {
          logError(errorMsg);
        }
        process.exit(1);
      }

      // Output result
      if (globalOpts.json) {
        const result: InitResult = {
          success: true,
          action: 'created',
          path: manifestPath,
          manifest: {
            name: manifest.name,
            type: manifest.type,
            version: manifest.version,
          },
          analysis: analysisResult ? {
            commands_detected: analysisResult.cliCommands.length,
            dependencies_detected: analysisResult.dependencies.length,
            mcp_tools_detected: analysisResult.mcpTools.length,
            type_detected: manifest.type,
          } : undefined,
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('Created pai-manifest.yaml');
        console.log(`  Name: ${manifest.name}`);
        console.log(`  Type: ${manifest.type}`);
        console.log(`  Version: ${manifest.version}`);
        if (analysisResult) {
          console.log();
          console.log('Analysis results:');
          console.log(`  Commands detected: ${analysisResult.cliCommands.length}`);
          console.log(`  Dependencies detected: ${analysisResult.dependencies.length}`);
          console.log(`  MCP tools detected: ${analysisResult.mcpTools.length}`);
        }
        console.log();
        if (analysisData) {
          console.log('Next steps:');
          console.log('  1. Review and adjust the generated manifest');
          console.log(`  2. Run: pai-deps register ${targetDir}`);
        } else {
          console.log('Next steps:');
          console.log('  1. Edit pai-manifest.yaml to add provides and depends_on');
          console.log(`  2. Run: pai-deps register ${targetDir}`);
        }
      }
    });
}
