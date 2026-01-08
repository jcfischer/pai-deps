/**
 * Source code analyzer for auto-generating pai-manifest.yaml
 *
 * Analyzes TypeScript/JavaScript source files to detect:
 * - CLI commands (from Commander.js patterns)
 * - PAI tool dependencies (from imports)
 * - CLI tool executions (from Bun.spawn/exec calls)
 * - MCP tool registrations
 */

import { join } from 'node:path';

/**
 * Result of analyzing a project
 */
export interface AnalysisResult {
  cliCommands: string[];
  dependencies: DetectedDep[];
  mcpTools: string[];
  warnings: string[];
}

/**
 * A detected dependency
 */
export interface DetectedDep {
  name: string;
  type: 'library' | 'cli';
  source: 'import' | 'spawn' | 'exec';
}

/**
 * Known PAI tools for detection
 */
export const PAI_TOOLS = [
  'resona',
  'supertag',
  'email',
  'ical',
  'calendar',
  'tado',
  'pii',
  'ragent',
  'finance',
  'reporter',
  'playwright-mcp',
  'gutenberg-tana',
  'kai-launcher',
];

/**
 * Find TypeScript/JavaScript source files in a directory
 */
export async function findSourceFiles(dir: string): Promise<string[]> {
  const glob = new Bun.Glob('src/**/*.{ts,js}');
  const files: string[] = [];
  for await (const file of glob.scan(dir)) {
    files.push(file);
  }
  return files;
}

/**
 * Detect CLI commands from Commander.js patterns
 *
 * Matches patterns like:
 * - .command('search')
 * - .command("list")
 * - program.command('show')
 */
export function detectCommands(sourceCode: string): string[] {
  const COMMAND_PATTERN = /\.command\s*\(\s*['"]([^'"]+)['"]/g;
  const commands: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = COMMAND_PATTERN.exec(sourceCode)) !== null) {
    commands.push(match[1]!);
  }

  return [...new Set(commands)]; // Deduplicate
}

/**
 * Detect PAI library imports
 *
 * Matches patterns like:
 * - import { x } from '@pai/resona'
 * - import x from '../../supertag/src'
 * - const x = require('@pai/email')
 */
export function detectPaiImports(sourceCode: string): DetectedDep[] {
  const deps: DetectedDep[] = [];
  const seen = new Set<string>();

  // @pai/* imports
  const PAI_IMPORT_PATTERN = /@pai\/(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = PAI_IMPORT_PATTERN.exec(sourceCode)) !== null) {
    const toolName = match[1]!;
    if (PAI_TOOLS.includes(toolName) && !seen.has(toolName)) {
      seen.add(toolName);
      deps.push({
        name: toolName,
        type: 'library',
        source: 'import',
      });
    }
  }

  // Relative imports containing PAI tool names
  for (const tool of PAI_TOOLS) {
    if (!seen.has(tool)) {
      const pattern = new RegExp(`from\\s+['"].*${tool}.*['"]`, 'g');
      if (pattern.test(sourceCode)) {
        seen.add(tool);
        deps.push({
          name: tool,
          type: 'library',
          source: 'import',
        });
      }
    }
  }

  return deps;
}

/**
 * Detect CLI tool executions via Bun.spawn/exec
 *
 * Matches patterns like:
 * - Bun.spawn(['supertag', 'search'])
 * - exec('email send')
 * - execSync(`${tool} list`)
 */
export function detectCliCalls(sourceCode: string): DetectedDep[] {
  const deps: DetectedDep[] = [];
  const seen = new Set<string>();

  // Bun.spawn patterns: Bun.spawn(['tool', ...])
  const SPAWN_PATTERN = /Bun\.spawn\s*\(\s*\[\s*['"](\w+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = SPAWN_PATTERN.exec(sourceCode)) !== null) {
    const toolName = match[1]!;
    if (PAI_TOOLS.includes(toolName) && !seen.has(toolName)) {
      seen.add(toolName);
      deps.push({
        name: toolName,
        type: 'cli',
        source: 'spawn',
      });
    }
  }

  // exec/execSync patterns: exec('tool ...')
  const EXEC_PATTERN = /exec(?:Sync)?\s*\(\s*['"`](\w+)/g;
  while ((match = EXEC_PATTERN.exec(sourceCode)) !== null) {
    const toolName = match[1]!;
    if (PAI_TOOLS.includes(toolName) && !seen.has(toolName)) {
      seen.add(toolName);
      deps.push({
        name: toolName,
        type: 'cli',
        source: 'exec',
      });
    }
  }

  return deps;
}

/**
 * Detect MCP tool registrations
 *
 * Matches patterns like:
 * - server.tool('tool_name', ...)
 * - .tool('tool_name', ...)
 */
export function detectMcpTools(sourceCode: string): string[] {
  const MCP_TOOL_PATTERN = /\.tool\s*\(\s*['"]([^'"]+)['"]/g;
  const tools: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = MCP_TOOL_PATTERN.exec(sourceCode)) !== null) {
    tools.push(match[1]!);
  }

  return [...new Set(tools)];
}

/**
 * Deduplicate dependencies, keeping first occurrence
 */
function deduplicateDeps(deps: DetectedDep[]): DetectedDep[] {
  const seen = new Map<string, DetectedDep>();
  for (const dep of deps) {
    if (!seen.has(dep.name)) {
      seen.set(dep.name, dep);
    }
  }
  return Array.from(seen.values());
}

/**
 * Analyze a project directory and detect manifest information
 */
export async function analyzeProject(dir: string): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    cliCommands: [],
    dependencies: [],
    mcpTools: [],
    warnings: [],
  };

  // Find source files
  const files = await findSourceFiles(dir);
  if (files.length === 0) {
    result.warnings.push('No source files found in src/');
    return result;
  }

  // Analyze each file
  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const content = await Bun.file(filePath).text();

      // Detect commands
      result.cliCommands.push(...detectCommands(content));

      // Detect PAI imports
      result.dependencies.push(...detectPaiImports(content));

      // Detect CLI calls
      result.dependencies.push(...detectCliCalls(content));

      // Detect MCP tools
      result.mcpTools.push(...detectMcpTools(content));
    } catch (err) {
      // Skip files that can't be read
      result.warnings.push(`Could not read ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Deduplicate
  result.cliCommands = [...new Set(result.cliCommands)];
  result.dependencies = deduplicateDeps(result.dependencies);
  result.mcpTools = [...new Set(result.mcpTools)];

  return result;
}
