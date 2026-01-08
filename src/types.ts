/**
 * Global CLI options available to all commands
 */
export interface GlobalOptions {
  /** Output as JSON for scripting */
  json: boolean;
  /** Suppress non-essential output */
  quiet: boolean;
  /** Verbose output with debug information */
  verbose: boolean;
}

/**
 * Types of tools that can be tracked
 */
export type ToolType =
  | 'cli'           // Command-line tool
  | 'mcp'           // MCP server
  | 'skill'         // Claude Code skill
  | 'library'       // Shared library
  | 'service';      // Background service

/**
 * Types of dependencies between tools
 */
export type DependencyType =
  | 'runtime'       // Required at runtime
  | 'build'         // Required for building
  | 'optional'      // Optional enhancement
  | 'peer';         // Must be compatible version

/**
 * Result returned by all commands
 */
export interface CommandResult<T = unknown> {
  /** Whether the command succeeded */
  success: boolean;
  /** Human-readable message */
  message: string;
  /** Optional data payload */
  data?: T | undefined;
  /** Error details if success is false */
  error?: string | undefined;
}

/**
 * Tool definition for dependency tracking
 */
export interface Tool {
  /** Unique identifier (e.g., "email", "tana-mcp") */
  id: string;
  /** Human-readable name */
  name: string;
  /** What kind of tool this is */
  type: ToolType;
  /** Filesystem path to the tool */
  path: string;
  /** Tool description */
  description?: string;
  /** Version if available */
  version?: string;
}

/**
 * Dependency relationship between tools
 */
export interface Dependency {
  /** ID of the tool that has the dependency */
  sourceId: string;
  /** ID of the tool being depended on */
  targetId: string;
  /** Type of dependency */
  type: DependencyType;
  /** Optional notes about the dependency */
  notes?: string;
}

/**
 * Types of interface contracts
 */
export type ContractType =
  | 'cli_output'      // CLI command JSON output schema
  | 'mcp_tool'        // MCP tool interface
  | 'library_export'  // Library public API
  | 'db_schema';      // Database schema

/**
 * Contract verification status
 */
export type ContractStatus =
  | 'valid'    // Contract verified successfully
  | 'drift'    // Schema changed but still valid
  | 'broken'   // Contract verification failed
  | 'unknown'; // Not yet verified

/**
 * Verification result status
 */
export type VerificationStatus =
  | 'pass'   // Verification passed
  | 'fail'   // Verification failed
  | 'drift'; // Schema drift detected

/**
 * Interface contract for a tool
 */
export interface Contract {
  /** Unique identifier */
  id: number;
  /** ID of the tool this contract belongs to */
  toolId: string;
  /** Type of contract */
  contractType: ContractType;
  /** Contract name (e.g., "email search --json") */
  name: string;
  /** Path to JSON schema file */
  schemaPath?: string;
  /** SHA256 hash for drift detection */
  schemaHash?: string;
  /** ISO timestamp of last verification */
  lastVerified?: string;
  /** Current contract status */
  status: ContractStatus;
}

/**
 * Verification record for a contract
 */
export interface Verification {
  /** Unique identifier */
  id: number;
  /** ID of the contract being verified */
  contractId: number;
  /** ISO timestamp of verification */
  verifiedAt: string;
  /** Verification status */
  status: VerificationStatus;
  /** JSON with error details or diff */
  details?: string;
  /** Git commit hash at verification time */
  gitCommit?: string;
}

/**
 * Detected circular dependency cycle
 */
export interface CircularDep {
  /** Unique identifier */
  id: number;
  /** Array of tool IDs in the cycle (stored as JSON) */
  cycle: string[];
  /** ISO timestamp when cycle was detected */
  detectedAt: string;
  /** Whether cycle has been manually resolved */
  resolved: boolean;
}
