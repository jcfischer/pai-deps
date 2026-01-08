# Technical Plan: F-024 Auto-discovery of manifests

## Architecture

### New Files
```
src/
├── lib/
│   └── discovery.ts       # Core discovery logic
└── commands/
    ├── discover.ts        # discover command
    └── sync.ts            # sync command
```

### Integration Points
- Uses existing `database.ts` for checking registered tools
- Uses existing `loadManifest()` from register command
- Imports `registerCommand` logic for sync

## Implementation Approach

### 1. Discovery Library (`src/lib/discovery.ts`)

Core function to find manifests recursively:

```typescript
interface DiscoveryOptions {
  roots: string[];           // Directories to search
  exclude: string[];         // Patterns to exclude (e.g., node_modules)
  maxDepth: number;          // Default: 10
  respectGitignore: boolean; // Default: true
}

interface DiscoveredManifest {
  path: string;              // Full path to pai-manifest.yaml
  name: string;              // Tool name from manifest
  exists: boolean;           // Already registered?
  needsUpdate: boolean;      // Different from registered version?
}

async function discoverManifests(options: DiscoveryOptions): Promise<DiscoveredManifest[]>
```

### 2. Default Exclusion Patterns

Hardcoded patterns that are always excluded:
- `node_modules`
- `.git`
- `dist`
- `build`
- `.cache`
- `coverage`

### 3. Gitignore Support

Use `ignore` npm package to parse .gitignore files at each directory level:
- Load `.gitignore` when entering a directory
- Inherit patterns from parent directories
- Skip matching paths

### 4. Commands

#### discover command
```bash
pai-deps discover [roots...]
  --include <pattern>   # Additional include patterns
  --exclude <pattern>   # Additional exclude patterns
  --max-depth <n>       # Maximum depth (default: 10)
  --no-gitignore        # Ignore .gitignore files
  --dry-run             # Just show what would be found
  --json                # Output as JSON
```

#### sync command
```bash
pai-deps sync [roots...]
  --include <pattern>   # Additional include patterns
  --exclude <pattern>   # Additional exclude patterns
  --force               # Re-register even if unchanged
  --dry-run             # Show what would be synced
  --json                # Output as JSON
```

## Dependencies

### npm packages needed
- `ignore` - For .gitignore parsing (already common, small footprint)

### Existing code reuse
- `loadManifest()` from register.ts
- Database operations from database.ts
- `registerCommand()` internal logic (refactor to share)

## Testing Strategy

### Unit Tests
1. Discovery with various directory structures
2. Gitignore pattern matching
3. Exclude pattern handling
4. Max depth limiting
5. Symlink handling

### Integration Tests
1. Full discover workflow with real directory
2. Sync workflow with database
3. Idempotency of sync

## Failure Mode Analysis

| Failure Mode | Detection | Degradation |
|--------------|-----------|-------------|
| Root doesn't exist | Check before walk | Error with helpful message |
| Permission denied | Catch EACCES | Skip with warning, continue |
| Invalid YAML | yaml.parse error | Skip with warning, continue |
| Symlink loop | Track visited inodes | Skip, don't follow |
| Very large dir | Count entries | Skip dirs with 1000+ items |
