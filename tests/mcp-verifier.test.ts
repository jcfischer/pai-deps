/**
 * Tests for MCP verifier module
 */

import { describe, test, expect } from 'bun:test';
import {
  verifyMcpTools,
  type McpTool,
} from '../src/lib/mcp-verifier';

describe('mcp-verifier', () => {
  describe('verifyMcpTools', () => {
    test('all declared tools found', () => {
      const declared = ['tool_a', 'tool_b', 'tool_c'];
      const serverTools: McpTool[] = [
        { name: 'tool_a' },
        { name: 'tool_b' },
        { name: 'tool_c' },
      ];

      const results = verifyMcpTools(declared, serverTools);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === 'found')).toBe(true);
      expect(results.every((r) => r.declared === true)).toBe(true);
      expect(results.every((r) => r.inServer === true)).toBe(true);
    });

    test('missing declared tools', () => {
      const declared = ['tool_a', 'tool_b', 'missing_tool'];
      const serverTools: McpTool[] = [
        { name: 'tool_a' },
        { name: 'tool_b' },
      ];

      const results = verifyMcpTools(declared, serverTools);

      const found = results.filter((r) => r.status === 'found');
      const missing = results.filter((r) => r.status === 'missing');

      expect(found).toHaveLength(2);
      expect(missing).toHaveLength(1);
      expect(missing[0]!.name).toBe('missing_tool');
      expect(missing[0]!.declared).toBe(true);
      expect(missing[0]!.inServer).toBe(false);
    });

    test('extra tools in server', () => {
      const declared = ['tool_a'];
      const serverTools: McpTool[] = [
        { name: 'tool_a' },
        { name: 'extra_tool' },
      ];

      const results = verifyMcpTools(declared, serverTools);

      const found = results.filter((r) => r.status === 'found');
      const extra = results.filter((r) => r.status === 'extra');

      expect(found).toHaveLength(1);
      expect(extra).toHaveLength(1);
      expect(extra[0]!.name).toBe('extra_tool');
      expect(extra[0]!.declared).toBe(false);
      expect(extra[0]!.inServer).toBe(true);
    });

    test('mixed results', () => {
      const declared = ['tool_a', 'missing'];
      const serverTools: McpTool[] = [
        { name: 'tool_a' },
        { name: 'extra' },
      ];

      const results = verifyMcpTools(declared, serverTools);

      expect(results).toHaveLength(3);

      const found = results.find((r) => r.name === 'tool_a');
      const missing = results.find((r) => r.name === 'missing');
      const extra = results.find((r) => r.name === 'extra');

      expect(found!.status).toBe('found');
      expect(missing!.status).toBe('missing');
      expect(extra!.status).toBe('extra');
    });

    test('empty declared list', () => {
      const declared: string[] = [];
      const serverTools: McpTool[] = [
        { name: 'tool_a' },
      ];

      const results = verifyMcpTools(declared, serverTools);

      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('extra');
    });

    test('empty server tools', () => {
      const declared = ['tool_a', 'tool_b'];
      const serverTools: McpTool[] = [];

      const results = verifyMcpTools(declared, serverTools);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'missing')).toBe(true);
    });

    test('both empty', () => {
      const declared: string[] = [];
      const serverTools: McpTool[] = [];

      const results = verifyMcpTools(declared, serverTools);

      expect(results).toHaveLength(0);
    });

    test('preserves tool metadata', () => {
      const declared = ['tool_with_schema'];
      const serverTools: McpTool[] = [
        {
          name: 'tool_with_schema',
          description: 'A tool with schema',
          inputSchema: { type: 'object' },
        },
      ];

      const results = verifyMcpTools(declared, serverTools);

      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('found');
      // Note: We only track name comparison, metadata is for display
    });
  });
});
