/**
 * Schema Hashing and Drift Detection for pai-deps
 *
 * Provides utilities to compute deterministic hashes of JSON schemas
 * and detect changes between stored and current hashes.
 */

import { createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

/**
 * Result of hashing JSON data
 */
export interface HashResult {
  /** SHA256 hash */
  hash: string;
  /** Normalized JSON string (for debugging) */
  normalized: string;
}

/**
 * Result of comparing two schemas
 */
export interface DriftResult {
  /** Status of the comparison */
  status: 'unchanged' | 'drift' | 'new' | 'missing' | 'error';
  /** Previously stored hash */
  storedHash?: string | undefined;
  /** Currently computed hash */
  currentHash?: string | undefined;
  /** Field-level changes if applicable */
  changes?: {
    added: string[];
    removed: string[];
  };
  /** Error message if status is 'error' */
  error?: string | undefined;
}

/**
 * Normalize a JSON value for deterministic hashing.
 * Sorts object keys recursively and removes whitespace.
 */
export function normalizeJson(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(normalizeJson).join(',') + ']';
  }

  // Object - sort keys and recurse
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${normalizeJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Compute SHA256 hash of normalized JSON data
 */
export function hashJson(data: unknown): HashResult {
  const normalized = normalizeJson(data);
  const hash = createHash('sha256').update(normalized).digest('hex');
  return { hash, normalized };
}

/**
 * Hash a JSON schema file from the filesystem
 */
export async function hashSchemaFile(schemaPath: string): Promise<HashResult | null> {
  try {
    // Check file exists
    await access(schemaPath, constants.R_OK);

    // Read and parse
    const content = await readFile(schemaPath, 'utf-8');
    const data = JSON.parse(content);

    return hashJson(data);
  } catch {
    return null;
  }
}

/**
 * Get all top-level keys from a JSON object (for field-level diff)
 */
function getTopLevelKeys(data: unknown): Set<string> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return new Set();
  }
  return new Set(Object.keys(data));
}

/**
 * Detect field-level changes between two JSON objects.
 * Only compares top-level keys for simplicity.
 */
export function detectFieldChanges(
  oldData: unknown,
  newData: unknown
): { added: string[]; removed: string[] } {
  const oldKeys = getTopLevelKeys(oldData);
  const newKeys = getTopLevelKeys(newData);

  const added = [...newKeys].filter((k) => !oldKeys.has(k));
  const removed = [...oldKeys].filter((k) => !newKeys.has(k));

  return { added, removed };
}

/**
 * Compare stored hash with current hash and determine drift status
 */
export function compareHashes(
  storedHash: string | null | undefined,
  currentHash: string | null | undefined
): DriftResult {
  // New contract (no stored hash)
  if (!storedHash && currentHash) {
    return {
      status: 'new',
      currentHash,
    };
  }

  // Missing (was present, now can't compute)
  if (storedHash && !currentHash) {
    return {
      status: 'missing',
      storedHash,
    };
  }

  // Both missing - error case
  if (!storedHash && !currentHash) {
    return {
      status: 'error',
      error: 'No hash available (stored or current)',
    };
  }

  // Compare hashes
  if (storedHash === currentHash) {
    return {
      status: 'unchanged',
      storedHash: storedHash ?? undefined,
      currentHash: currentHash ?? undefined,
    };
  }

  // Drift detected
  return {
    status: 'drift',
    storedHash: storedHash!,
    currentHash: currentHash!,
  };
}
