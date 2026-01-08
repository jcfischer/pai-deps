# Documentation Updates for F-014 Schema Hashing and Drift Detection

## Files Updated

- **README.md**:
  - Added `drift` command to commands table
  - Updated test count (269 → 301)
  - Added "Schema hashing and drift detection" to roadmap (marked complete)

- **src/lib/index.ts**:
  - Added exports for hasher module (normalizeJson, hashJson, hashSchemaFile, compareHashes, detectFieldChanges)

## New Documentation Created

- **CLAUDE.md** (project root): Complete project overview, stack conventions, drizzle-orm bug workaround
- **src/commands/CLAUDE.md**: Command handler patterns, output conventions, key files
- **src/lib/CLAUDE.md**: Library module overview, usage patterns
- **src/lib/graph/CLAUDE.md**: Graph algorithms documentation
- **src/db/CLAUDE.md**: Database schema, critical eq() bug documentation
- **tests/CLAUDE.md**: Testing patterns and conventions

## API Changes

New exports from `src/lib/index.ts`:
- `normalizeJson(value: unknown): string`
- `hashJson(data: unknown): HashResult`
- `hashSchemaFile(schemaPath: string): Promise<HashResult | null>`
- `compareHashes(stored, current): DriftResult`
- `detectFieldChanges(old, new): { added: string[], removed: string[] }`

## CLI Changes

New command: `pai-deps drift [tool]`
- Options: `--all`, `--update`
- Exit codes: 0 (no drift), 1 (drift detected)
