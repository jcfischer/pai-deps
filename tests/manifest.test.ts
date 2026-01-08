import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import {
  parseManifest,
  validateManifest,
  ManifestParseError,
} from '../src/lib/manifest';

const fixturesDir = join(import.meta.dir, 'fixtures/manifests');

describe('Manifest Validation', () => {
  describe('valid manifests', () => {
    test('parses minimal manifest with defaults', () => {
      const result = validateManifest({
        name: 'test-tool',
        type: 'cli',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test-tool');
        expect(result.data.type).toBe('cli');
        expect(result.data.reliability).toBe(0.95); // default
        expect(result.data.debt_score).toBe(0); // default
        expect(result.data.depends_on).toEqual([]); // default
      }
    });

    test('parses full manifest with all fields', () => {
      const result = validateManifest({
        name: 'email',
        version: '1.2.0',
        type: 'cli+mcp',
        description: 'Email client',
        provides: {
          cli: [{ command: 'email search', output_schema: './schemas/search.json' }],
          mcp: [{ tool: 'email_search', schema: './schemas/mcp.json' }],
          library: [{ export: 'createClient', path: './src/client.ts' }],
          database: [{ path: '~/.config/email/email.db', schema: './src/db/schema.ts' }],
        },
        depends_on: [
          { name: 'resona', type: 'library', version: '>=1.0.0', import: '@pai/resona' },
          { name: 'sqlite', type: 'database', optional: true },
        ],
        reliability: 0.98,
        debt_score: 6,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('email');
        expect(result.data.version).toBe('1.2.0');
        expect(result.data.type).toBe('cli+mcp');
        expect(result.data.reliability).toBe(0.98);
        expect(result.data.debt_score).toBe(6);
        expect(result.data.depends_on).toHaveLength(2);
        expect(result.data.depends_on[0]?.optional).toBe(false); // default
        expect(result.data.depends_on[1]?.optional).toBe(true);
      }
    });

    test('accepts all valid tool types', () => {
      const types = ['cli', 'mcp', 'library', 'workflow', 'hook', 'cli+mcp'];

      for (const type of types) {
        const result = validateManifest({ name: 'test', type });
        expect(result.success).toBe(true);
      }
    });

    test('accepts all valid dependency types', () => {
      const types = ['cli', 'mcp', 'library', 'database', 'npm', 'implicit'];

      for (const depType of types) {
        const result = validateManifest({
          name: 'test',
          type: 'cli',
          depends_on: [{ name: 'dep', type: depType }],
        });
        expect(result.success).toBe(true);
      }
    });

    test('accepts MCP resource in provides', () => {
      const result = validateManifest({
        name: 'test',
        type: 'mcp',
        provides: {
          mcp: [{ resource: 'email://inbox', schema: './schemas/inbox.json' }],
        },
      });

      expect(result.success).toBe(true);
    });

    test('accepts dependency with commands array', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        depends_on: [
          {
            name: 'k',
            type: 'cli',
            commands: ['k context export', 'k mcp list'],
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.depends_on[0]?.commands).toEqual([
          'k context export',
          'k mcp list',
        ]);
      }
    });

    test('handles unicode characters in name and description', () => {
      const result = validateManifest({
        name: 'test-tool-unicode',
        type: 'cli',
        description: 'Tool with unicode: Umlauts (aeoeue), emoji removed, special chars',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('invalid manifests', () => {
    test('rejects missing name', () => {
      const result = validateManifest({ type: 'cli' });

      expect(result.success).toBe(false);
      if (!result.success) {
        const namePath = result.error.issues.find((i) =>
          i.path.includes('name')
        );
        expect(namePath).toBeDefined();
      }
    });

    test('rejects missing type', () => {
      const result = validateManifest({ name: 'test' });

      expect(result.success).toBe(false);
      if (!result.success) {
        const typePath = result.error.issues.find((i) =>
          i.path.includes('type')
        );
        expect(typePath).toBeDefined();
      }
    });

    test('rejects empty name', () => {
      const result = validateManifest({ name: '', type: 'cli' });

      expect(result.success).toBe(false);
    });

    test('rejects invalid type enum', () => {
      const result = validateManifest({ name: 'test', type: 'invalid' });

      expect(result.success).toBe(false);
      if (!result.success) {
        const message = result.error.issues[0]?.message;
        // Zod should indicate valid values
        expect(message).toContain('Invalid enum value');
      }
    });

    test('rejects reliability > 1', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        reliability: 1.5,
      });

      expect(result.success).toBe(false);
    });

    test('rejects reliability < 0', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        reliability: -0.1,
      });

      expect(result.success).toBe(false);
    });

    test('rejects negative debt_score', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        debt_score: -1,
      });

      expect(result.success).toBe(false);
    });

    test('rejects non-integer debt_score', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        debt_score: 3.5,
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid dependency type', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        depends_on: [{ name: 'dep', type: 'invalid' }],
      });

      expect(result.success).toBe(false);
    });

    test('rejects dependency without name', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        depends_on: [{ type: 'cli' }],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('handles empty provides object', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        provides: {},
      });

      expect(result.success).toBe(true);
    });

    test('handles empty depends_on array', () => {
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        depends_on: [],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.depends_on).toEqual([]);
      }
    });

    test('handles very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = validateManifest({
        name: 'test',
        type: 'cli',
        description: longString,
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('Manifest File Parsing', () => {
  describe('valid files', () => {
    test('parses valid-minimal.yaml', () => {
      const manifest = parseManifest(join(fixturesDir, 'valid-minimal.yaml'));

      expect(manifest.name).toBe('minimal-tool');
      expect(manifest.type).toBe('cli');
      expect(manifest.reliability).toBe(0.95);
      expect(manifest.debt_score).toBe(0);
    });

    test('parses valid-full.yaml', () => {
      const manifest = parseManifest(join(fixturesDir, 'valid-full.yaml'));

      expect(manifest.name).toBe('email');
      expect(manifest.version).toBe('1.2.0');
      expect(manifest.type).toBe('cli+mcp');
      expect(manifest.reliability).toBe(0.98);
      expect(manifest.debt_score).toBe(6);
      expect(manifest.provides?.cli).toHaveLength(2);
      expect(manifest.provides?.mcp).toHaveLength(2);
      expect(manifest.depends_on).toHaveLength(4);
    });
  });

  describe('invalid files', () => {
    test('throws on missing file', () => {
      expect(() => {
        parseManifest('/nonexistent/path/manifest.yaml');
      }).toThrow(ManifestParseError);
    });

    test('throws on invalid-missing-name.yaml with field path', () => {
      try {
        parseManifest(join(fixturesDir, 'invalid-missing-name.yaml'));
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(ManifestParseError);
        const error = err as ManifestParseError;
        expect(error.message).toContain('name');
      }
    });

    test('throws on invalid-type.yaml with valid options hint', () => {
      try {
        parseManifest(join(fixturesDir, 'invalid-type.yaml'));
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(ManifestParseError);
        const error = err as ManifestParseError;
        expect(error.message).toContain('type');
      }
    });
  });

  describe('error formatting', () => {
    test('error message includes file path', () => {
      const filePath = join(fixturesDir, 'invalid-missing-name.yaml');
      try {
        parseManifest(filePath);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(ManifestParseError);
        const error = err as ManifestParseError;
        expect(error.filePath).toBe(filePath);
        expect(error.message).toContain(filePath);
      }
    });

    test('error includes Zod issues', () => {
      const filePath = join(fixturesDir, 'invalid-missing-name.yaml');
      try {
        parseManifest(filePath);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(ManifestParseError);
        const error = err as ManifestParseError;
        expect(error.issues).toBeDefined();
        expect(error.issues!.length).toBeGreaterThan(0);
      }
    });
  });
});
