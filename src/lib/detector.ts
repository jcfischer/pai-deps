/**
 * Package.json detection and manifest template generation
 *
 * Used by the init command to auto-detect tool information from package.json
 * and generate pai-manifest.yaml templates.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Information detected from package.json
 */
export interface DetectedInfo {
  name?: string;
  version?: string;
  type?: 'cli' | 'mcp' | 'library';
  description?: string;
}

/**
 * Detect tool information from package.json in a directory
 *
 * @param dir - Directory to check for package.json
 * @returns Detected information or empty object if no package.json
 */
export async function detectFromPackageJson(dir: string): Promise<DetectedInfo> {
  const pkgPath = join(dir, 'package.json');

  if (!existsSync(pkgPath)) {
    return {};
  }

  try {
    const pkg = await Bun.file(pkgPath).json();
    const result: DetectedInfo = {};

    // Name (strip @scope/ prefix)
    if (pkg.name) {
      result.name = pkg.name.replace(/^@[^/]+\//, '');
    }

    // Version
    if (pkg.version) {
      result.version = pkg.version;
    }

    // Description
    if (pkg.description) {
      result.description = pkg.description;
    }

    // Type detection:
    // 1. If bin field exists -> CLI
    // 2. If name/main contains "mcp" -> MCP
    // 3. Otherwise -> library
    if (pkg.bin) {
      result.type = 'cli';
    } else if (
      pkg.name?.toLowerCase().includes('mcp') ||
      pkg.main?.toLowerCase().includes('mcp')
    ) {
      result.type = 'mcp';
    } else {
      result.type = 'library';
    }

    return result;
  } catch {
    // If package.json is invalid, return empty
    return {};
  }
}

/**
 * Information for generating a manifest template
 */
export interface ManifestInfo {
  name: string;
  version: string;
  type: string;
  description: string;
}

/**
 * Analysis result for enhanced template generation
 */
export interface AnalysisData {
  cliCommands: string[];
  dependencies: { name: string; type: string }[];
  mcpTools: string[];
}

/**
 * Generate a pai-manifest.yaml template
 *
 * @param info - Information to include in the template
 * @param analysis - Optional analysis data for enhanced generation
 * @returns YAML template string
 */
export function generateManifestTemplate(
  info: ManifestInfo,
  analysis?: AnalysisData | null
): string {
  let yaml = '# PAI Dependency Manifest';

  if (analysis) {
    yaml += ' (auto-generated)\n# Review and adjust as needed';
  }

  yaml += `
name: ${info.name}
version: ${info.version}
type: ${info.type}
`;

  if (info.description) {
    yaml += `description: ${info.description}\n`;
  } else {
    yaml += '# description: \n';
  }

  yaml += '\nprovides:\n';

  // CLI commands
  if (analysis?.cliCommands && analysis.cliCommands.length > 0) {
    yaml += '  cli:\n';
    for (const cmd of analysis.cliCommands) {
      // Handle commands that already have arguments (like 'show <id>')
      const cmdWithName = cmd.includes(' ') || cmd.includes('<')
        ? `${info.name} ${cmd}`
        : `${info.name} ${cmd}`;
      yaml += `    - command: ${cmdWithName}\n`;
    }
  } else {
    yaml += `  # cli:\n  #   - command: "${info.name} <subcommand>"\n`;
  }

  // MCP tools
  if (analysis?.mcpTools && analysis.mcpTools.length > 0) {
    yaml += '  mcp:\n';
    for (const tool of analysis.mcpTools) {
      yaml += `    - tool: ${tool}\n`;
    }
  }

  yaml += '\ndepends_on:';

  // Dependencies
  if (analysis?.dependencies && analysis.dependencies.length > 0) {
    yaml += '\n';
    for (const dep of analysis.dependencies) {
      yaml += `  - name: ${dep.name}\n    type: ${dep.type}\n`;
    }
  } else {
    yaml += ' []\n';
  }

  yaml += `
reliability: 0.95
debt_score: 0
`;

  return yaml;
}
