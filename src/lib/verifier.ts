/**
 * CLI Contract Verifier for pai-deps
 *
 * Verifies that CLI commands declared in manifests actually exist
 * and work as expected.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseManifest } from './manifest.js';

/**
 * Result of running a command
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

/**
 * Checks performed on a command
 */
export interface VerifyCheck {
  exists: boolean;
  helpAvailable?: boolean;
}

/**
 * Result of verifying a single command
 */
export interface VerifyResult {
  command: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  checks: VerifyCheck;
  duration: number;
}

/**
 * Result of verifying all commands for a tool
 */
export interface ToolVerifyResult {
  tool: string;
  type: string;
  results: VerifyResult[];
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
}

/**
 * Options for verification
 */
export interface VerifyOptions {
  /** Only check command existence (skip help check) */
  quick?: boolean;
  /** Timeout per command in ms (default: 5000) */
  timeout?: number;
}

/**
 * Run a command with timeout
 */
async function runCommand(
  cmd: string,
  args: string[],
  timeout: number
): Promise<CommandResult> {
  return new Promise((resolve) => {
    let timedOut = false;

    const proc = spawn(cmd, args, {
      timeout,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode,
        timedOut,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 127, // Command not found
        timedOut: false,
      });
    });
  });
}

/**
 * Verify a single CLI command
 */
export async function verifyCliCommand(
  command: string,
  options: VerifyOptions = {}
): Promise<VerifyResult> {
  const { quick = false, timeout = 5000 } = options;
  const startTime = Date.now();

  // Parse command into parts, removing argument placeholders
  // e.g., "pai-deps init <path>" -> ["pai-deps", "init"]
  // e.g., "pai-deps discover [roots...]" -> ["pai-deps", "discover"]
  const parts = command
    .split(/\s+/)
    .filter((part) => !part.startsWith('<') && !part.startsWith('['));
  const bin = parts[0];
  const subcommands = parts.slice(1);

  // Check if command exists by running with --help
  const helpArgs = [...subcommands, '--help'];
  const result = await runCommand(bin!, helpArgs, timeout);
  const duration = Date.now() - startTime;

  // Check results
  if (result.timedOut) {
    return {
      command,
      status: 'fail',
      error: `Command timed out after ${timeout}ms`,
      checks: { exists: false },
      duration,
    };
  }

  // Exit code 0 or help text in output indicates command exists
  // Some tools return non-zero for --help but still show help
  const hasHelpOutput =
    result.stdout.length > 0 ||
    result.stderr.includes('Usage') ||
    result.stderr.includes('usage');
  const commandExists = result.exitCode === 0 || hasHelpOutput;

  if (!commandExists) {
    return {
      command,
      status: 'fail',
      error:
        result.exitCode === 127
          ? 'Command not found'
          : `Command failed with exit code ${result.exitCode}`,
      checks: { exists: false },
      duration,
    };
  }

  // If quick mode, we're done
  if (quick) {
    return {
      command,
      status: 'pass',
      checks: { exists: true },
      duration,
    };
  }

  // Check that help is available
  const helpAvailable = result.stdout.length > 10 || result.stderr.length > 10;

  return {
    command,
    status: 'pass',
    checks: {
      exists: true,
      helpAvailable,
    },
    duration,
  };
}

/**
 * Get CLI commands from a tool's manifest
 */
export async function getToolCliCommands(
  toolPath: string
): Promise<string[] | null> {
  const manifestPath = join(toolPath, 'pai-manifest.yaml');

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const manifest = await parseManifest(manifestPath);

    if (!manifest.provides?.cli || manifest.provides.cli.length === 0) {
      return [];
    }

    return manifest.provides.cli.map((c) => c.command);
  } catch {
    return null;
  }
}

/**
 * Verify all CLI commands for a tool
 */
export async function verifyTool(
  toolId: string,
  toolPath: string,
  toolType: string,
  options: VerifyOptions = {}
): Promise<ToolVerifyResult> {
  const results: VerifyResult[] = [];

  // Skip non-CLI tools
  if (toolType === 'library') {
    return {
      tool: toolId,
      type: toolType,
      results: [
        {
          command: '(library - no CLI)',
          status: 'skip',
          checks: { exists: false },
          duration: 0,
        },
      ],
      summary: { passed: 0, failed: 0, skipped: 1, total: 1 },
    };
  }

  // Get CLI commands from manifest
  const commands = await getToolCliCommands(toolPath);

  if (commands === null) {
    return {
      tool: toolId,
      type: toolType,
      results: [
        {
          command: '(manifest not found)',
          status: 'skip',
          error: `No manifest at ${toolPath}`,
          checks: { exists: false },
          duration: 0,
        },
      ],
      summary: { passed: 0, failed: 0, skipped: 1, total: 1 },
    };
  }

  if (commands.length === 0) {
    return {
      tool: toolId,
      type: toolType,
      results: [
        {
          command: '(no CLI commands declared)',
          status: 'skip',
          checks: { exists: false },
          duration: 0,
        },
      ],
      summary: { passed: 0, failed: 0, skipped: 1, total: 1 },
    };
  }

  // Verify each command
  for (const command of commands) {
    const result = await verifyCliCommand(command, options);
    results.push(result);
  }

  // Calculate summary
  const summary = {
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    total: results.length,
  };

  return {
    tool: toolId,
    type: toolType,
    results,
    summary,
  };
}
