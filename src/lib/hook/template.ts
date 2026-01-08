/**
 * Hook script template generation
 */

import { HOOK_MARKER } from './types.js';

export interface TemplateOptions {
  quick: boolean;
}

/**
 * Generate POSIX-compliant pre-commit hook script
 *
 * @param options - Template options
 * @returns Complete hook script content
 */
export function generateHookScript(options: TemplateOptions): string {
  const timestamp = new Date().toISOString();
  const quickFlag = options.quick ? ' --quick' : '';

  return `#!/bin/sh
${HOOK_MARKER}
# Installed: ${timestamp}
# Quick mode: ${options.quick}

# Check if pai-deps is available
if ! command -v pai-deps >/dev/null 2>&1; then
  echo "pai-deps not found, skipping pre-commit checks"
  exit 0
fi

echo "Running pai-deps contract verification..."
pai-deps ci check --staged${quickFlag}
exit $?
`;
}
