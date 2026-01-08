/**
 * Type definitions and Zod schemas for hook management
 */

import { z } from 'zod';

/**
 * Metadata embedded in hook script comments
 */
export interface HookMetadata {
  marker: 'pai-deps pre-commit hook';
  installedAt: string;
  quickMode: boolean;
}

/**
 * Hook status response
 */
export interface HookStatus {
  installed: boolean;
  installedAt: string | null;
  quickMode: boolean;
  backupExists: boolean;
  foreignHookExists: boolean;
}

/**
 * Result from install operation
 */
export interface InstallResult {
  success: boolean;
  backupCreated: boolean;
  hookPath: string;
}

/**
 * Result from uninstall operation
 */
export interface UninstallResult {
  success: boolean;
  backupRestored: boolean;
}

/**
 * Options for install command
 */
export interface InstallOptions {
  force?: boolean | undefined;
  quick?: boolean | undefined;
}

/**
 * Zod schema for hook status (JSON output)
 */
export const HookStatusSchema = z.object({
  installed: z.boolean(),
  installedAt: z.string().nullable(),
  quickMode: z.boolean(),
  backupExists: z.boolean(),
  foreignHookExists: z.boolean(),
});

/**
 * Zod schema for install options
 */
export const InstallOptionsSchema = z.object({
  force: z.boolean().default(false),
  quick: z.boolean().default(false),
});

/**
 * Zod schema for install result (JSON output)
 */
export const InstallResultSchema = z.object({
  success: z.boolean(),
  backupCreated: z.boolean(),
  hookPath: z.string(),
  error: z.string().optional(),
});

/**
 * Zod schema for uninstall result (JSON output)
 */
export const UninstallResultSchema = z.object({
  success: z.boolean(),
  backupRestored: z.boolean(),
  error: z.string().optional(),
});

/**
 * Hook marker constant for identification
 */
export const HOOK_MARKER = '# pai-deps pre-commit hook' as const;
