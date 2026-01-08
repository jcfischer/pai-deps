#!/usr/bin/env bun
import { Command } from 'commander';
import type { GlobalOptions } from './types.js';
import { setGlobalOptions, output, debug, success } from './lib/output.js';
import { registerCommand } from './commands/register.js';
import { listCommand } from './commands/list.js';
import { showCommand } from './commands/show.js';
import { unregisterCommand } from './commands/unregister.js';
import { initCommand } from './commands/init.js';
import { depsCommand } from './commands/deps.js';
import { rdepsCommand } from './commands/rdeps.js';
import { graphCommand } from './commands/graph.js';
import { verifyCommand } from './commands/verify.js';
import { pathCommand } from './commands/path.js';
import { allpathsCommand } from './commands/allpaths.js';
import { discoverCommand } from './commands/discover.js';
import { syncCommand } from './commands/sync.js';
import { driftCommand } from './commands/drift.js';
import { verifyOutputCommand } from './commands/verify-output.js';
import { affectedCommand } from './commands/affected.js';
import { chainReliabilityCommand } from './commands/chain-reliability.js';
import { verifyHistoryCommand } from './commands/verify-history.js';
import { blastRadiusCommand } from './commands/blast-radius.js';
import { debtCommand } from './commands/debt.js';
import { reportCommand } from './commands/report.js';
import { healthCommand } from './commands/health.js';
import { speckitCommand } from './commands/speckit.js';
import { ciCommand } from './commands/ci.js';
import { hookCommand } from './commands/hook.js';

// Version is embedded at import time (works with bun compile)
import packageJson from '../package.json';

const program = new Command();

program
  .name('pai-deps')
  .description('Dependency management for PAI tools - track what uses what')
  .version(packageJson.version, '-V, --version', 'Output the version number')
  .option('--json', 'Output as JSON for scripting', false)
  .option('-q, --quiet', 'Suppress non-essential output', false)
  .option('-v, --verbose', 'Verbose output with debug information', false)
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts() as GlobalOptions;
    setGlobalOptions(opts);
    debug('Global options set');
  });

// Ping command for testing CLI setup
program
  .command('ping')
  .description('Test CLI connectivity')
  .action(() => {
    debug('Executing ping command');
    output(success('pong', { timestamp: new Date().toISOString() }));
  });

// Register command
registerCommand(program);

// List command
listCommand(program);

// Show command
showCommand(program);

// Unregister command
unregisterCommand(program);

// Init command
initCommand(program);

// Deps command (forward dependencies)
depsCommand(program);

// Rdeps command (reverse dependencies)
rdepsCommand(program);

// Graph command (DOT/SVG visualization)
graphCommand(program);

// Verify command (CLI contract verification)
verifyCommand(program);

// Path command (shortest path)
pathCommand(program);

// Allpaths command (all paths)
allpathsCommand(program);

// Discover command
discoverCommand(program);

// Sync command
syncCommand(program);

// Drift command (schema drift detection)
driftCommand(program);

// Verify-output command (runtime output validation)
verifyOutputCommand(program);

// Affected command (what breaks if this changes)
affectedCommand(program);

// Chain reliability command (compound reliability calculation)
chainReliabilityCommand(program);

// Verify history command (verification history query)
verifyHistoryCommand(program);

// Blast radius command (impact analysis)
blastRadiusCommand(program);

// Debt command (debt aggregation)
debtCommand(program);

// Report command (comprehensive Markdown report)
reportCommand(program);

// Health command (ASCII dashboard)
healthCommand(program);

// SpecKit integration commands
speckitCommand(program);

// CI integration commands
ciCommand(program);

// Hook management commands
hookCommand(program);

// Handle unknown commands
program.on('command:*', (operands: string[]) => {
  const unknownCommand = operands[0];
  console.error(`Error: Unknown command '${unknownCommand}'`);
  console.error();
  console.error('Available commands:');
  program.commands.forEach((cmd) => {
    console.error(`  ${cmd.name().padEnd(15)} ${cmd.description()}`);
  });
  console.error();
  console.error(`Run 'pai-deps --help' for usage information.`);
  process.exit(1);
});

// Parse and execute
program.parse(process.argv);

// If no command specified, show help
if (process.argv.length === 2) {
  program.help();
}
