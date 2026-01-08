/**
 * Hook metadata parsing
 */

import { HOOK_MARKER, type HookMetadata } from './types.js';

/**
 * Check if content represents a pai-deps hook script
 *
 * @param content - Hook file content
 * @returns true if this is a pai-deps hook
 */
export function isPaiDepsHook(content: string): boolean {
  return content.includes(HOOK_MARKER);
}

/**
 * Parse metadata from hook script comments
 *
 * @param content - Hook file content
 * @returns Parsed metadata or null if not a pai-deps hook
 */
export function parseHookMetadata(content: string): HookMetadata | null {
  if (!isPaiDepsHook(content)) {
    return null;
  }

  // Parse installation timestamp
  const installedMatch = content.match(/^# Installed: (.+)$/m);
  const installedAt = installedMatch ? installedMatch[1]!.trim() : new Date().toISOString();

  // Parse quick mode setting
  const quickMatch = content.match(/^# Quick mode: (.+)$/m);
  const quickMode = quickMatch ? quickMatch[1]!.trim() === 'true' : false;

  return {
    marker: 'pai-deps pre-commit hook',
    installedAt,
    quickMode,
  };
}
