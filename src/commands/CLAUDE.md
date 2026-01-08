# src/commands/ - CLI Command Handlers

Each file exports a function that registers a Commander.js command with the program.

## Pattern

```typescript
import type { Command } from 'commander';
import { getGlobalOptions, error as logError } from '../lib/output.js';

interface MyCommandOptions {
  someFlag?: boolean;
}

interface MyJsonOutput {
  success: boolean;
  error?: string;
  // ... command-specific fields
}

export function myCommand(program: Command): void {
  program
    .command('my-command <required-arg>')
    .description('What this command does')
    .option('-f, --some-flag', 'Description of flag')
    .action(async (requiredArg: string, options: MyCommandOptions) => {
      const opts = getGlobalOptions();

      try {
        // Implementation...

        if (opts.json) {
          const output: MyJsonOutput = { success: true, /* ... */ };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log('Human readable output');
        }
      } catch (err) {
        if (opts.json) {
          console.log(JSON.stringify({ success: false, error: err.message }));
        } else {
          logError(err.message);
        }
        process.exit(1);
      }
    });
}
```

## Registration

After creating a command, register it in `src/index.ts`:

```typescript
import { myCommand } from './commands/my-command.js';

// ... after other commands
myCommand(program);
```

## Output Conventions

1. **JSON mode** (`--json`): Always return structured object with `success` boolean
2. **Human mode**: Use formatted text, tables, or lists
3. **Errors**: Exit with code 1, output error message in both modes
4. **Status indicators**: Use `✓` for success, `✗` for failure, `⚠` for warnings

## Key Files

| File | Command | Feature |
|------|---------|---------|
| `register.ts` | `register <path>` | Register tool from manifest |
| `list.ts` | `list` | List all registered tools |
| `show.ts` | `show <tool>` | Show tool details |
| `deps.ts` | `deps <tool>` | Forward dependencies |
| `rdeps.ts` | `rdeps <tool>` | Reverse dependencies |
| `graph.ts` | `graph` | DOT/SVG visualization |
| `verify.ts` | `verify [tool]` | CLI contract verification |
| `drift.ts` | `drift [tool]` | Schema drift detection |
| `path.ts` | `path <from> <to>` | Shortest dependency path |
| `allpaths.ts` | `allpaths <from> <to>` | All dependency paths |
| `discover.ts` | `discover [roots...]` | Find manifests |
| `sync.ts` | `sync [roots...]` | Discover and register |

## Known Issues

- **drizzle eq() bug**: See root CLAUDE.md. Use JS `.filter()` instead of SQL WHERE.
- **Exit codes**: Always call `process.exit(1)` on errors for CI compatibility.
