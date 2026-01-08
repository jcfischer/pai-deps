/**
 * Hook management module
 *
 * Provides functionality for installing, uninstalling, and managing
 * git pre-commit hooks for pai-deps contract verification.
 */

export { HookManager, NotGitRepoError, HookExistsError, ForeignHookError } from './manager.js';
export { generateHookScript } from './template.js';
export { isPaiDepsHook, parseHookMetadata } from './parser.js';
export {
  HOOK_MARKER,
  HookStatusSchema,
  InstallOptionsSchema,
  InstallResultSchema,
  UninstallResultSchema,
  type HookMetadata,
  type HookStatus,
  type InstallResult,
  type UninstallResult,
  type InstallOptions,
} from './types.js';
