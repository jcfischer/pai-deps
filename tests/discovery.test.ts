/**
 * Tests for manifest discovery functionality
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverManifests } from '../src/lib/discovery';

describe('discoverManifests', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `pai-deps-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should find manifest in root directory', async () => {
    // Create manifest in test directory
    writeFileSync(join(testDir, 'pai-manifest.yaml'), 'name: test-tool\ntype: cli\n');

    const results = await discoverManifests({ roots: [testDir] });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('test-tool');
    expect(results[0]!.path).toContain('pai-manifest.yaml');
  });

  it('should find manifests in subdirectories', async () => {
    // Create nested structure
    const subDir = join(testDir, 'tools', 'email');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'pai-manifest.yaml'), 'name: email\ntype: cli\n');

    const results = await discoverManifests({ roots: [testDir] });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('email');
  });

  it('should find multiple manifests', async () => {
    // Create multiple tools
    const tool1 = join(testDir, 'tool1');
    const tool2 = join(testDir, 'tool2');
    mkdirSync(tool1, { recursive: true });
    mkdirSync(tool2, { recursive: true });
    writeFileSync(join(tool1, 'pai-manifest.yaml'), 'name: tool1\ntype: cli\n');
    writeFileSync(join(tool2, 'pai-manifest.yaml'), 'name: tool2\ntype: mcp\n');

    const results = await discoverManifests({ roots: [testDir] });

    expect(results).toHaveLength(2);
    const names = results.map(r => r.name).sort();
    expect(names).toEqual(['tool1', 'tool2']);
  });

  it('should skip node_modules directory', async () => {
    // Create manifest in node_modules
    const nodeModules = join(testDir, 'node_modules', 'some-package');
    mkdirSync(nodeModules, { recursive: true });
    writeFileSync(join(nodeModules, 'pai-manifest.yaml'), 'name: hidden\ntype: cli\n');

    // Create manifest outside node_modules
    writeFileSync(join(testDir, 'pai-manifest.yaml'), 'name: visible\ntype: cli\n');

    const results = await discoverManifests({ roots: [testDir] });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('visible');
  });

  it('should skip .git directory', async () => {
    // Create manifest in .git
    const gitDir = join(testDir, '.git', 'hooks');
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, 'pai-manifest.yaml'), 'name: hidden\ntype: cli\n');

    const results = await discoverManifests({ roots: [testDir] });

    expect(results).toHaveLength(0);
  });

  it('should respect custom exclude patterns', async () => {
    // Create manifests
    const keep = join(testDir, 'keep');
    const skip = join(testDir, 'skip-this');
    mkdirSync(keep, { recursive: true });
    mkdirSync(skip, { recursive: true });
    writeFileSync(join(keep, 'pai-manifest.yaml'), 'name: keep\ntype: cli\n');
    writeFileSync(join(skip, 'pai-manifest.yaml'), 'name: skip\ntype: cli\n');

    const results = await discoverManifests({
      roots: [testDir],
      exclude: ['skip-*'],
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('keep');
  });

  it('should respect max depth limit', async () => {
    // Create deeply nested manifest
    const deep = join(testDir, 'a', 'b', 'c', 'd', 'e');
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(deep, 'pai-manifest.yaml'), 'name: deep\ntype: cli\n');

    // Create shallow manifest
    writeFileSync(join(testDir, 'pai-manifest.yaml'), 'name: shallow\ntype: cli\n');

    const results = await discoverManifests({
      roots: [testDir],
      maxDepth: 2, // Only go 2 levels deep
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('shallow');
  });

  it('should respect .gitignore files when enabled', async () => {
    // Create .gitignore
    writeFileSync(join(testDir, '.gitignore'), 'ignored/\n');

    // Create ignored and visible manifests
    const ignored = join(testDir, 'ignored');
    const visible = join(testDir, 'visible');
    mkdirSync(ignored, { recursive: true });
    mkdirSync(visible, { recursive: true });
    writeFileSync(join(ignored, 'pai-manifest.yaml'), 'name: ignored\ntype: cli\n');
    writeFileSync(join(visible, 'pai-manifest.yaml'), 'name: visible\ntype: cli\n');

    const results = await discoverManifests({
      roots: [testDir],
      respectGitignore: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('visible');
  });

  it('should ignore .gitignore files when disabled', async () => {
    // Create .gitignore
    writeFileSync(join(testDir, '.gitignore'), 'ignored/\n');

    // Create ignored and visible manifests
    const ignored = join(testDir, 'ignored');
    const visible = join(testDir, 'visible');
    mkdirSync(ignored, { recursive: true });
    mkdirSync(visible, { recursive: true });
    writeFileSync(join(ignored, 'pai-manifest.yaml'), 'name: ignored\ntype: cli\n');
    writeFileSync(join(visible, 'pai-manifest.yaml'), 'name: visible\ntype: cli\n');

    const results = await discoverManifests({
      roots: [testDir],
      respectGitignore: false,
    });

    expect(results).toHaveLength(2);
    const names = results.map(r => r.name).sort();
    expect(names).toEqual(['ignored', 'visible']);
  });

  it('should return empty array for non-existent root', async () => {
    const results = await discoverManifests({
      roots: ['/non/existent/path/that/does/not/exist'],
    });

    expect(results).toHaveLength(0);
  });

  it('should handle multiple roots', async () => {
    // Create second test directory
    const testDir2 = join(tmpdir(), `pai-deps-test2-${Date.now()}`);
    mkdirSync(testDir2, { recursive: true });

    try {
      // Create manifests in both directories
      writeFileSync(join(testDir, 'pai-manifest.yaml'), 'name: tool1\ntype: cli\n');
      writeFileSync(join(testDir2, 'pai-manifest.yaml'), 'name: tool2\ntype: cli\n');

      const results = await discoverManifests({
        roots: [testDir, testDir2],
      });

      expect(results).toHaveLength(2);
      const names = results.map(r => r.name).sort();
      expect(names).toEqual(['tool1', 'tool2']);
    } finally {
      rmSync(testDir2, { recursive: true, force: true });
    }
  });

  it('should extract tool name from manifest', async () => {
    writeFileSync(join(testDir, 'pai-manifest.yaml'), `
name: my-awesome-tool
version: 1.2.3
type: mcp
description: An awesome tool
`);

    const results = await discoverManifests({ roots: [testDir] });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('my-awesome-tool');
  });

  it('should handle manifest without name field', async () => {
    writeFileSync(join(testDir, 'pai-manifest.yaml'), 'type: cli\n');

    const results = await discoverManifests({ roots: [testDir] });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBeNull();
  });

  it('should include dir path in results', async () => {
    writeFileSync(join(testDir, 'pai-manifest.yaml'), 'name: test\ntype: cli\n');

    const results = await discoverManifests({ roots: [testDir] });

    expect(results).toHaveLength(1);
    expect(results[0]!.dir).toBe(testDir);
  });
});
