/**
 * JSON Schema Validator for pai-deps
 *
 * Validates tool outputs against their declared JSON schemas.
 * Uses Ajv for JSON Schema draft-07 validation.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { getDb } from '../db/index.js';
import { tools, contracts } from '../db/schema.js';

/**
 * A single validation error
 */
export interface ValidationError {
  /** JSON pointer path to the error location */
  path: string;
  /** Human-readable error message */
  message: string;
  /** JSON Schema keyword that failed */
  keyword: string;
  /** Additional parameters from the schema keyword */
  params: Record<string, unknown>;
}

/**
 * Result of validating data against a schema
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if invalid */
  errors?: ValidationError[];
}

/**
 * Result of loading a contract schema
 */
export interface SchemaLoadResult {
  /** Whether schema was loaded successfully */
  success: boolean;
  /** The loaded schema object */
  schema?: object;
  /** Error message if loading failed */
  error?: string;
  /** Path to the schema file */
  schemaPath?: string;
}

// Create Ajv instance with common formats (email, uri, date-time, etc.)
const ajv = new Ajv({
  allErrors: true,      // Report all errors, not just first
  verbose: true,        // Include schema and data in errors
  strict: false,        // Allow unknown formats
});
addFormats(ajv);

/**
 * Validate data against a JSON Schema
 */
export function validateAgainstSchema(
  schema: object,
  data: unknown
): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true };
  }

  // Convert Ajv errors to our format
  const errors: ValidationError[] = (validate.errors || []).map((err) => ({
    path: err.instancePath || '/',
    message: err.message || 'Unknown validation error',
    keyword: err.keyword,
    params: err.params as Record<string, unknown>,
  }));

  return { valid: false, errors };
}

/**
 * Load and parse a JSON schema file
 */
export async function loadSchemaFile(schemaPath: string): Promise<object | null> {
  try {
    await access(schemaPath, constants.R_OK);
    const content = await readFile(schemaPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Load the schema for a specific contract from the database
 */
export async function loadContractSchema(
  toolId: string,
  contractName: string
): Promise<SchemaLoadResult> {
  const db = getDb();

  // Find the tool
  const allTools = db.select().from(tools).all();
  const tool = allTools.find((t) => t.id === toolId);

  if (!tool) {
    return { success: false, error: `Tool '${toolId}' not found` };
  }

  // Find the contract
  const allContracts = db.select().from(contracts).all();
  const contract = allContracts.find(
    (c) => c.toolId === toolId && c.name === contractName
  );

  if (!contract) {
    return {
      success: false,
      error: `Contract '${contractName}' not found for tool '${toolId}'`,
    };
  }

  // Check schema path exists
  if (!contract.schemaPath) {
    return {
      success: false,
      error: `Contract '${contractName}' has no schema_path defined`,
    };
  }

  // Resolve schema path relative to tool path
  const schemaPath = isAbsolute(contract.schemaPath)
    ? contract.schemaPath
    : join(tool.path, contract.schemaPath);

  // Load the schema
  const schema = await loadSchemaFile(schemaPath);

  if (!schema) {
    return {
      success: false,
      error: `Schema file not found: ${schemaPath}`,
      schemaPath,
    };
  }

  return { success: true, schema, schemaPath };
}

/**
 * Format validation errors for human-readable output
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'No errors';
  }

  const lines = errors.map((err) => {
    const path = err.path || '/';
    return `  - ${path}: ${err.message}`;
  });

  return lines.join('\n');
}
