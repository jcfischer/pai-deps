# Technical Plan: F-005 - Unregister, List, and Show Commands

**Feature ID:** F-005
**Phase:** 1 (Core Registry)
**Estimated Hours:** 3

---

## Approach

Implement three commands in separate files under `src/commands/`. Create shared table formatting utilities in `src/lib/table.ts`. Use Drizzle ORM for database queries.

---

## Technical Design

### Architecture

```
src/commands/
├── register.ts      # (F-004)
├── list.ts          # List command
├── show.ts          # Show command
└── unregister.ts    # Unregister command

src/lib/
├── table.ts         # ASCII table formatting
└── queries.ts       # Shared database queries
```

### List Command (`src/commands/list.ts`)

```typescript
import { Command } from 'commander';
import { getDb } from '../db';
import { tools } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { formatTable } from '../lib/table';

export function listCommand(program: Command) {
  program
    .command('list')
    .description('List all registered tools')
    .option('--type <type>', 'Filter by tool type')
    .option('--stubs', 'Show only stubs')
    .option('--no-stubs', 'Hide stubs')
    .action(async (options) => {
      const opts = program.opts();
      const db = await getDb();

      // Build query with filters
      let query = db.select().from(tools);

      if (options.type) {
        query = query.where(eq(tools.type, options.type));
      }
      if (options.stubs === true) {
        query = query.where(eq(tools.stub, 1));
      } else if (options.stubs === false) {
        query = query.where(eq(tools.stub, 0));
      }

      const allTools = await query.orderBy(tools.name);

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          tools: allTools.map(t => ({
            id: t.id,
            type: t.type,
            version: t.version,
            reliability: t.reliability,
            debtScore: t.debtScore,
            stub: t.stub === 1,
          })),
          total: allTools.length,
          stubs: allTools.filter(t => t.stub === 1).length,
        }, null, 2));
        return;
      }

      if (allTools.length === 0) {
        console.log('No tools registered');
        return;
      }

      // Format as table
      const headers = ['ID', 'Type', 'Version', 'Deps', 'Reliability', 'Debt', 'Status'];
      const rows = allTools.map(t => [
        t.id,
        t.type,
        t.version || '-',
        '?', // Count deps in separate query
        t.reliability?.toFixed(2) ?? '-',
        t.debtScore?.toString() ?? '-',
        t.stub === 1 ? '[stub]' : '●',
      ]);

      console.log(formatTable(headers, rows));
      console.log(`${allTools.length} tools (${allTools.filter(t => t.stub === 1).length} stubs)`);
    });
}
```

### Show Command (`src/commands/show.ts`)

```typescript
import { Command } from 'commander';
import { getDb } from '../db';
import { tools, dependencies, contracts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { parseManifest } from '../lib/manifest';

export function showCommand(program: Command) {
  program
    .command('show <tool>')
    .description('Show details for a tool')
    .action(async (toolId: string) => {
      const opts = program.opts();
      const db = await getDb();

      // Get tool
      const [tool] = await db.select().from(tools).where(eq(tools.id, toolId));
      if (!tool) {
        if (opts.json) {
          console.log(JSON.stringify({ success: false, error: `Tool '${toolId}' not found` }));
        } else {
          console.error(`Error: Tool '${toolId}' not found`);
        }
        process.exit(1);
      }

      // Get dependencies (tools this one depends on)
      const deps = await db.select().from(dependencies).where(eq(dependencies.consumerId, toolId));

      // Get dependents (tools that depend on this one)
      const dependents = await db.select().from(dependencies).where(eq(dependencies.providerId, toolId));

      // Get provides from manifest if available
      let provides = null;
      if (tool.manifestPath) {
        try {
          const manifest = parseManifest(tool.manifestPath);
          provides = manifest.provides;
        } catch {
          // Manifest might not exist anymore
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          tool: { ...tool, stub: tool.stub === 1 },
          dependencies: deps,
          dependents: dependents.map(d => d.consumerId),
          provides,
        }, null, 2));
        return;
      }

      // Human-readable output
      console.log(`Tool: ${tool.name}`);
      console.log(`Version: ${tool.version || '-'}`);
      console.log(`Type: ${tool.type}`);
      console.log(`Path: ${tool.path}`);
      console.log();
      console.log(`Reliability: ${tool.reliability}`);
      console.log(`Debt Score: ${tool.debtScore}`);
      if (tool.lastVerified) {
        console.log(`Last Verified: ${tool.lastVerified}`);
      }
      console.log();

      if (deps.length > 0) {
        console.log(`Dependencies (${deps.length}):`);
        deps.forEach((d, i) => {
          const prefix = i === deps.length - 1 ? '└──' : '├──';
          console.log(`  ${prefix} ${d.providerId} (${d.type})${d.versionConstraint ? ` ${d.versionConstraint}` : ''}`);
        });
      }

      if (dependents.length > 0) {
        console.log();
        console.log(`Depended on by (${dependents.length}):`);
        dependents.forEach((d, i) => {
          const prefix = i === dependents.length - 1 ? '└──' : '├──';
          console.log(`  ${prefix} ${d.consumerId}`);
        });
      }
    });
}
```

### Unregister Command (`src/commands/unregister.ts`)

```typescript
import { Command } from 'commander';
import { getDb } from '../db';
import { tools, dependencies } from '../db/schema';
import { eq } from 'drizzle-orm';

export function unregisterCommand(program: Command) {
  program
    .command('unregister <tool>')
    .description('Remove a tool from the registry')
    .option('--force', 'Force removal even if other tools depend on it')
    .action(async (toolId: string, options) => {
      const opts = program.opts();
      const db = await getDb();

      // Check if tool exists
      const [tool] = await db.select().from(tools).where(eq(tools.id, toolId));
      if (!tool) {
        if (opts.json) {
          console.log(JSON.stringify({ success: false, error: `Tool '${toolId}' not found` }));
        } else {
          console.error(`Error: Tool '${toolId}' not found`);
        }
        process.exit(1);
      }

      // Check for dependents
      const dependents = await db.select().from(dependencies).where(eq(dependencies.providerId, toolId));

      if (dependents.length > 0 && !options.force) {
        const dependentIds = dependents.map(d => d.consumerId);
        if (opts.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'Tool has dependents',
            dependents: dependentIds,
            hint: 'Use --force to remove anyway',
          }));
        } else {
          console.error(`Cannot unregister '${toolId}': the following tools depend on it:`);
          dependentIds.forEach(id => console.error(`  - ${id}`));
          console.error('Use --force to remove anyway.');
        }
        process.exit(1);
      }

      // Delete tool (cascade handles consumer dependencies)
      await db.delete(tools).where(eq(tools.id, toolId));

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          action: 'unregistered',
          tool: toolId,
          affectedDependents: dependents.map(d => d.consumerId),
        }));
      } else {
        console.log(`Unregistered ${toolId}`);
        if (dependents.length > 0) {
          console.log(`  Warning: ${dependents.length} tools still reference this tool`);
        }
      }
    });
}
```

### Table Formatting (`src/lib/table.ts`)

```typescript
export function formatTable(headers: string[], rows: string[][]): string {
  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map(r => (r[i] || '').length));
    return Math.max(h.length, maxRowWidth);
  });

  const lines: string[] = [];

  // Header
  lines.push(headers.map((h, i) => h.padEnd(widths[i])).join('  '));

  // Separator
  lines.push(widths.map(w => '─'.repeat(w)).join('──'));

  // Rows
  for (const row of rows) {
    lines.push(row.map((cell, i) => (cell || '').padEnd(widths[i])).join('  '));
  }

  return lines.join('\n');
}
```

---

## Failure Mode Analysis

### How This Code Can Fail

| Failure Mode | Trigger | Detection | Degradation | Recovery |
|--------------|---------|-----------|-------------|----------|
| Tool not found | Invalid ID | Query returns empty | Clear error | User checks ID |
| Manifest missing | File deleted | Parse throws | Show without provides | Log warning |
| Dependent check | Race condition | Check before delete | Force flag | User retries |

### Blast Radius

- **Files touched:** 5 new files
- **Systems affected:** Database (reads, one delete)
- **Rollback strategy:** Re-register tool from manifest

---

## Implementation Steps

1. Create `src/lib/table.ts` with formatTable function
2. Create `src/lib/queries.ts` for shared queries (optional)
3. Implement `src/commands/list.ts`
4. Implement `src/commands/show.ts`
5. Implement `src/commands/unregister.ts`
6. Wire up commands in `src/index.ts`
7. Create tests for each command

---

## Testing Strategy

### Unit Tests

```typescript
describe('List Command', () => {
  test('lists all tools in table format');
  test('lists tools as JSON with --json');
  test('filters by type');
  test('shows only stubs with --stubs');
  test('handles empty registry');
});

describe('Show Command', () => {
  test('shows tool details');
  test('shows dependencies and dependents');
  test('outputs JSON with --json');
  test('errors for unknown tool');
});

describe('Unregister Command', () => {
  test('removes tool from database');
  test('requires --force when tool has dependents');
  test('succeeds with --force');
  test('errors for unknown tool');
});
```

---

## Doctorow Gate Checklist

- [ ] **Failure test:** What happens with non-existent tool? (clear error)
- [ ] **Failure test:** What happens if manifest is deleted? (show works without provides)
- [ ] **Assumption test:** Handles 100+ tools in list?
- [ ] **Rollback test:** Can re-register after unregister?
- [ ] **Debt recorded:** Score 3 (essential but simple commands)

---

## References

- Spec: `/Users/fischer/work/pai-deps/.specify/specs/f-005-unregister-list-and-show-commands/spec.md`
- F-004: Register command
