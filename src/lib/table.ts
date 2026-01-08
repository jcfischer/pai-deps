/**
 * ASCII table and tree formatting utilities for pai-deps
 *
 * Provides formatted output for CLI commands with proper column alignment
 * and Unicode box-drawing characters.
 */

/**
 * Format data as an ASCII table with headers
 *
 * @param headers - Column header names
 * @param rows - Data rows as string arrays
 * @returns Formatted table string
 */
export function formatTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';

  // Calculate column widths (max of header and all row values)
  const widths = headers.map((h, i) => {
    const rowWidths = rows.map((r) => (r[i] ?? '').length);
    return Math.max(h.length, ...rowWidths);
  });

  const lines: string[] = [];

  // Header row
  lines.push(headers.map((h, i) => h.padEnd(widths[i]!)).join('  '));

  // Separator line with Unicode box-drawing character
  lines.push(widths.map((w) => '─'.repeat(w)).join('──'));

  // Data rows
  for (const row of rows) {
    lines.push(row.map((cell, i) => (cell ?? '').padEnd(widths[i]!)).join('  '));
  }

  return lines.join('\n');
}

/**
 * Format items as a tree structure with box-drawing characters
 *
 * @param items - Items to display in tree
 * @param indent - Number of spaces to indent (default: 0)
 * @returns Formatted tree string
 */
export function formatTree(items: string[], indent: number = 0): string {
  if (items.length === 0) return '';

  const prefix = ' '.repeat(indent);
  const lines: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const isLast = i === items.length - 1;
    const branch = isLast ? '└──' : '├──';
    lines.push(`${prefix}${branch} ${items[i]}`);
  }

  return lines.join('\n');
}

/**
 * Format a tree item with additional metadata
 *
 * @param name - Item name
 * @param metadata - Optional metadata string (e.g., "(library) >=1.0.0")
 * @returns Formatted item string
 */
export function formatTreeItem(name: string, metadata?: string): string {
  return metadata ? `${name} ${metadata}` : name;
}
