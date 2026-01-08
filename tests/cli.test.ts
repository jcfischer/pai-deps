import { describe, test, expect } from 'bun:test';
import { $ } from 'bun';

const CLI_PATH = new URL('../src/index.ts', import.meta.url).pathname;

describe('pai-deps CLI', () => {
  describe('--help', () => {
    test('shows help text', async () => {
      const result = await $`bun ${CLI_PATH} --help`.text();
      expect(result).toContain('pai-deps');
      expect(result).toContain('Dependency management for PAI tools');
      expect(result).toContain('--json');
      expect(result).toContain('--quiet');
      expect(result).toContain('--verbose');
    });

    test('shows available commands', async () => {
      const result = await $`bun ${CLI_PATH} --help`.text();
      expect(result).toContain('ping');
    });
  });

  describe('--version', () => {
    test('shows version number', async () => {
      const result = await $`bun ${CLI_PATH} --version`.text();
      expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('ping command', () => {
    test('returns pong', async () => {
      const result = await $`bun ${CLI_PATH} ping`.text();
      expect(result.trim()).toBe('pong');
    });

    test('returns JSON with --json flag', async () => {
      const result = await $`bun ${CLI_PATH} --json ping`.text();
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('pong');
      expect(parsed.data.timestamp).toBeDefined();
    });

    test('suppresses output with --quiet', async () => {
      const result = await $`bun ${CLI_PATH} --quiet ping`.text();
      expect(result.trim()).toBe('');
    });

    test('shows debug info with --verbose', async () => {
      const result = await $`bun ${CLI_PATH} --verbose ping`.text();
      expect(result).toContain('[debug]');
      expect(result).toContain('pong');
    });
  });

  describe('unknown command', () => {
    test('shows error for unknown command', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH, 'unknown-cmd'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unknown command 'unknown-cmd'");
      expect(stderr).toContain('Available commands:');
    });
  });
});
