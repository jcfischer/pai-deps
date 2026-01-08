import type { GlobalOptions, CommandResult } from '../types.js';

/**
 * Current global options - set by the CLI before command execution
 */
let globalOptions: GlobalOptions = {
  json: false,
  quiet: false,
  verbose: false,
};

/**
 * Set global options from CLI parsing
 */
export function setGlobalOptions(options: GlobalOptions): void {
  globalOptions = options;
}

/**
 * Get current global options
 */
export function getGlobalOptions(): GlobalOptions {
  return globalOptions;
}

/**
 * Output command result - respects --json flag
 * @param result - Command result to output
 */
export function output<T>(result: CommandResult<T>): void {
  if (globalOptions.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!globalOptions.quiet || !result.success) {
    if (result.success) {
      console.log(result.message);
      if (result.data && globalOptions.verbose) {
        console.log(JSON.stringify(result.data, null, 2));
      }
    } else {
      console.error(`Error: ${result.message}`);
      if (result.error && globalOptions.verbose) {
        console.error(`Details: ${result.error}`);
      }
    }
  }
}

/**
 * Log informational message - suppressed with --quiet
 * @param message - Message to log
 */
export function log(message: string): void {
  if (!globalOptions.quiet) {
    console.log(message);
  }
}

/**
 * Log debug message - only shown with --verbose
 * @param message - Debug message to log
 */
export function debug(message: string): void {
  if (globalOptions.verbose && !globalOptions.quiet) {
    console.log(`[debug] ${message}`);
  }
}

/**
 * Log warning message - always shown unless --quiet
 * @param message - Warning message to log
 */
export function warn(message: string): void {
  if (!globalOptions.quiet) {
    console.warn(`Warning: ${message}`);
  }
}

/**
 * Log error message - always shown
 * @param message - Error message to log
 */
export function error(message: string): void {
  console.error(`Error: ${message}`);
}

/**
 * Create a success result
 */
export function success<T>(message: string, data?: T): CommandResult<T> {
  return { success: true, message, data };
}

/**
 * Create a failure result
 */
export function failure(message: string, error?: string): CommandResult<never> {
  return { success: false, message, error };
}
