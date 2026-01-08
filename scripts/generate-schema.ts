#!/usr/bin/env bun
/**
 * Generate JSON Schema from Zod schema
 *
 * Run with: bun run scripts/generate-schema.ts
 * Or: bun run generate:schema
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ManifestSchema } from '../src/lib/manifest';

const jsonSchema = zodToJsonSchema(ManifestSchema, {
  $refStrategy: 'none', // Inline all definitions for simpler schema
});

// Add metadata
const schemaWithMeta = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'PAI Manifest Schema',
  description:
    'Schema for pai-manifest.yaml - declares tool identity, provides, and dependencies',
  ...jsonSchema,
};

const outputPath = './schemas/manifest.json';
await Bun.write(outputPath, JSON.stringify(schemaWithMeta, null, 2) + '\n');

console.log(`Generated ${outputPath}`);
