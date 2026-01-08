# Technical Plan: F-014 Schema Hashing and Drift Detection

## Architecture

### Files to Create
- `src/lib/hasher.ts` - Schema hashing utilities
- `src/commands/drift.ts` - Drift detection command

### Files to Modify
- `src/index.ts` - Register drift command

## Implementation Details

### 1. Schema Hasher (`src/lib/hasher.ts`)

```typescript
interface HashResult {
  hash: string;
  normalized: string;  // For debugging
}

// Compute SHA256 hash of normalized JSON
function hashJson(data: unknown): HashResult

// Hash a schema file from path
async function hashSchemaFile(schemaPath: string): Promise<HashResult | null>

// Hash actual CLI output by running command
async function hashCliOutput(command: string): Promise<HashResult | null>

// Compare two hashes and detect field-level changes
interface DriftResult {
  status: 'unchanged' | 'drift' | 'new' | 'missing';
  storedHash?: string;
  currentHash?: string;
  changes?: {
    added: string[];
    removed: string[];
  };
}
function compareHashes(stored: string | null, current: string | null): DriftResult
```

### 2. Drift Command (`src/commands/drift.ts`)

```typescript
interface DriftOptions {
  all?: boolean;
  update?: boolean;
}

interface ContractDriftResult {
  contract: string;
  contractType: string;
  status: 'unchanged' | 'drift' | 'new' | 'missing' | 'error';
  storedHash?: string;
  currentHash?: string;
  changes?: { added: string[]; removed: string[] };
  error?: string;
}

interface DriftJsonOutput {
  success: boolean;
  tool?: string;
  results?: ContractDriftResult[];
  summary?: {
    unchanged: number;
    drifted: number;
    new: number;
    missing: number;
    total: number;
  };
  error?: string;
}
```

## Data Flow

1. `drift <tool>` called
2. Load contracts for tool from database
3. For each contract with schema_path:
   a. Load stored hash from contracts.schema_hash
   b. Compute current hash from schema file
   c. Compare hashes
   d. If CLI contract, optionally run command and hash output
4. Display results
5. If `--update`, update contracts.schema_hash with new values

## Database Interactions

**Read:**
- tools table (get tool by id)
- contracts table (get contracts for tool)

**Write (on --update):**
- contracts.schema_hash (update with new hash)
- contracts.last_verified (update timestamp)
- verifications table (add record of drift check)

## Dependencies

- Built-in crypto module for SHA256
- JSON normalization (sort keys recursively)
- Existing verifier.ts for running CLI commands
