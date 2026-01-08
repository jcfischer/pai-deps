/**
 * Blast Radius command for pai-deps
 *
 * Shows detailed impact analysis for changes to a tool including:
 * - Affected tool counts by type and depth
 * - Risk score calculation
 * - Rollback strategy suggestions
 */

import type { Command } from 'commander';
import { getDb, tools } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { DependencyGraph } from '../lib/graph/index.js';
import { getGlobalOptions, error as logError } from '../lib/output.js';
import { formatTable } from '../lib/table.js';

/**
 * Risk level thresholds
 */
const RISK_LEVELS = {
  LOW: 20,
  MEDIUM: 50,
  HIGH: 100,
  // CRITICAL: above HIGH
} as const;

/**
 * Affected tool with extended information
 */
interface AffectedTool {
  id: string;
  name: string;
  type: string;
  reliability: number;
  debtScore: number;
  depth: number;
}

/**
 * Impact summary by type
 */
interface TypeImpact {
  type: string;
  count: number;
  critical: boolean;
}

/**
 * Risk assessment result
 */
interface RiskAssessment {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  chainReliability: number;
  avgDebtScore: number;
  criticalCount: number;
}

/**
 * Complete blast radius analysis
 */
interface BlastRadiusAnalysis {
  tool: string;
  directCount: number;
  transitiveCount: number;
  totalCount: number;
  maxDepth: number;
  risk: RiskAssessment;
  typeImpacts: TypeImpact[];
  depthDistribution: Map<number, number>;
  affectedTools: AffectedTool[];
  rollbackStrategy: string[];
}

/**
 * JSON output format
 */
interface BlastRadiusJsonOutput {
  success: boolean;
  error?: string | undefined;
  analysis?: {
    tool: string;
    impact: {
      directCount: number;
      transitiveCount: number;
      totalCount: number;
      maxDepth: number;
    };
    risk: {
      score: number;
      level: string;
      chainReliability: number;
      avgDebtScore: number;
      criticalCount: number;
    };
    byType: Array<{ type: string; count: number; critical: boolean }>;
    byDepth: Array<{ depth: number; count: number }>;
    affectedTools: AffectedTool[];
    rollbackStrategy: string[];
  };
}

/**
 * Get affected tools with extended information using BFS
 */
async function getAffectedTools(
  graph: DependencyGraph,
  startId: string,
  db: ReturnType<typeof getDb>
): Promise<AffectedTool[]> {
  const depths = new Map<string, number>();
  const queue: [string, number][] = [];

  // Start with direct dependents at depth 1
  for (const dep of graph.getDependents(startId)) {
    queue.push([dep.id, 1]);
    depths.set(dep.id, 1);
  }

  // BFS to find all dependents with minimum depths
  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;

    for (const next of graph.getDependents(current)) {
      if (next.id !== startId && !depths.has(next.id)) {
        depths.set(next.id, depth + 1);
        queue.push([next.id, depth + 1]);
      }
    }
  }

  // Build result with extended node info
  const result: AffectedTool[] = [];
  for (const [id, depth] of depths) {
    const node = graph.getNode(id);
    if (node) {
      // Get debt score from database
      const toolRecord = db.select().from(tools).where(eq(tools.id, id)).all();
      const debtScore = toolRecord[0]?.debtScore ?? 0;

      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        reliability: node.reliability,
        debtScore,
        depth,
      });
    }
  }

  return result.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
}

/**
 * Calculate risk score from affected tools
 */
function calculateRiskAssessment(
  affected: AffectedTool[],
  graph: DependencyGraph,
  startId: string
): RiskAssessment {
  if (affected.length === 0) {
    return {
      score: 0,
      level: 'LOW',
      chainReliability: 1.0,
      avgDebtScore: 0,
      criticalCount: 0,
    };
  }

  // Count critical tools (MCP)
  const criticalCount = affected.filter((t) => t.type === 'mcp' || t.type.includes('mcp')).length;

  // Calculate average debt score
  const totalDebt = affected.reduce((sum, t) => sum + t.debtScore, 0);
  const avgDebtScore = totalDebt / affected.length;

  // Calculate chain reliability to max depth
  // Get the path to the furthest affected tool
  const maxDepth = Math.max(...affected.map((t) => t.depth));
  const startNode = graph.getNode(startId);
  const startReliability = startNode?.reliability ?? 0.95;

  // Estimate chain reliability (simplified: start * average of affected)
  const avgReliability = affected.reduce((sum, t) => sum + t.reliability, 0) / affected.length;
  const chainReliability = startReliability * Math.pow(avgReliability, Math.min(maxDepth, 3));

  // Calculate risk score
  const baseScore = affected.length;
  const debtMultiplier = 1 + avgDebtScore / 10;
  const reliabilityPenalty = 1 / Math.max(chainReliability, 0.1);
  const criticalBonus = criticalCount * 5;

  const score = baseScore * debtMultiplier * reliabilityPenalty + criticalBonus;

  // Determine risk level
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (score <= RISK_LEVELS.LOW) {
    level = 'LOW';
  } else if (score <= RISK_LEVELS.MEDIUM) {
    level = 'MEDIUM';
  } else if (score <= RISK_LEVELS.HIGH) {
    level = 'HIGH';
  } else {
    level = 'CRITICAL';
  }

  return {
    score: Math.round(score * 10) / 10,
    level,
    chainReliability: Math.round(chainReliability * 1000) / 1000,
    avgDebtScore: Math.round(avgDebtScore * 10) / 10,
    criticalCount,
  };
}

/**
 * Group affected tools by type
 */
function getTypeImpacts(affected: AffectedTool[]): TypeImpact[] {
  const typeCounts = new Map<string, number>();

  for (const tool of affected) {
    const type = tool.type;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  const impacts: TypeImpact[] = [];
  for (const [type, count] of typeCounts) {
    impacts.push({
      type,
      count,
      critical: type === 'mcp' || type.includes('mcp'),
    });
  }

  // Sort: critical first, then by count descending
  return impacts.sort((a, b) => {
    if (a.critical !== b.critical) return a.critical ? -1 : 1;
    return b.count - a.count;
  });
}

/**
 * Get depth distribution
 */
function getDepthDistribution(affected: AffectedTool[]): Map<number, number> {
  const distribution = new Map<number, number>();

  for (const tool of affected) {
    distribution.set(tool.depth, (distribution.get(tool.depth) ?? 0) + 1);
  }

  return distribution;
}

/**
 * Generate rollback strategy suggestions
 */
function generateRollbackStrategy(
  affected: AffectedTool[],
  typeImpacts: TypeImpact[],
  risk: RiskAssessment
): string[] {
  const strategy: string[] = [];

  if (affected.length === 0) {
    strategy.push('No affected tools - changes are isolated');
    return strategy;
  }

  // 1. MCP tools first
  const hasMcp = typeImpacts.some((t) => t.critical);
  if (hasMcp) {
    strategy.push('1. Test affected MCP tools first (real-time integrations at risk)');
  }

  // 2. Direct dependents
  const directCount = affected.filter((t) => t.depth === 1).length;
  if (directCount > 0) {
    strategy.push(`2. Verify ${directCount} direct dependent(s) before deployment`);
  }

  // 3. High debt tools
  const highDebtTools = affected.filter((t) => t.debtScore > 5);
  if (highDebtTools.length > 0) {
    strategy.push(`3. Extra attention on ${highDebtTools.length} high-debt tool(s): ${highDebtTools.map((t) => t.id).join(', ')}`);
  }

  // 4. Feature flag suggestion for high risk
  if (risk.level === 'HIGH' || risk.level === 'CRITICAL') {
    strategy.push('4. Consider feature flag for gradual rollout');
  }

  // 5. Chain reliability warning
  if (risk.chainReliability < 0.8) {
    strategy.push(`5. Warning: Chain reliability is ${(risk.chainReliability * 100).toFixed(1)}% - add error boundaries`);
  }

  // 6. Testing order
  const maxDepth = Math.max(...affected.map((t) => t.depth));
  if (maxDepth > 1) {
    strategy.push(`6. Test from innermost (depth 1) to outermost (depth ${maxDepth})`);
  }

  return strategy;
}

/**
 * Perform complete blast radius analysis
 */
async function analyzeBlastRadius(
  graph: DependencyGraph,
  toolId: string,
  db: ReturnType<typeof getDb>
): Promise<BlastRadiusAnalysis> {
  const affected = await getAffectedTools(graph, toolId, db);

  const directCount = affected.filter((t) => t.depth === 1).length;
  const transitiveCount = affected.filter((t) => t.depth > 1).length;
  const maxDepth = affected.length > 0 ? Math.max(...affected.map((t) => t.depth)) : 0;

  const risk = calculateRiskAssessment(affected, graph, toolId);
  const typeImpacts = getTypeImpacts(affected);
  const depthDistribution = getDepthDistribution(affected);
  const rollbackStrategy = generateRollbackStrategy(affected, typeImpacts, risk);

  return {
    tool: toolId,
    directCount,
    transitiveCount,
    totalCount: affected.length,
    maxDepth,
    risk,
    typeImpacts,
    depthDistribution,
    affectedTools: affected,
    rollbackStrategy,
  };
}

/**
 * Format risk level with indicator
 */
function formatRiskLevel(level: string): string {
  switch (level) {
    case 'LOW':
      return 'LOW';
    case 'MEDIUM':
      return 'MEDIUM ⚠';
    case 'HIGH':
      return 'HIGH ⚠⚠';
    case 'CRITICAL':
      return 'CRITICAL 🔴';
    default:
      return level;
  }
}

/**
 * Register the 'blast-radius' command with the program
 */
export function blastRadiusCommand(program: Command): void {
  program
    .command('blast-radius <tool>')
    .description('Analyze blast radius and risk of changes to a tool')
    .action(async (toolId: string) => {
      const opts = getGlobalOptions();
      const db = getDb();

      try {
        // Load dependency graph
        const graph = await DependencyGraph.load(db);

        // Check if tool exists
        if (!graph.hasNode(toolId)) {
          if (opts.json) {
            const output: BlastRadiusJsonOutput = {
              success: false,
              error: `Tool '${toolId}' not found`,
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            logError(`Tool '${toolId}' not found`);
          }
          process.exit(1);
        }

        // Perform analysis
        const analysis = await analyzeBlastRadius(graph, toolId, db);

        // JSON output
        if (opts.json) {
          const output: BlastRadiusJsonOutput = {
            success: true,
            analysis: {
              tool: analysis.tool,
              impact: {
                directCount: analysis.directCount,
                transitiveCount: analysis.transitiveCount,
                totalCount: analysis.totalCount,
                maxDepth: analysis.maxDepth,
              },
              risk: analysis.risk,
              byType: analysis.typeImpacts,
              byDepth: Array.from(analysis.depthDistribution.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([depth, count]) => ({ depth, count })),
              affectedTools: analysis.affectedTools,
              rollbackStrategy: analysis.rollbackStrategy,
            },
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Human-readable output
        console.log();
        console.log(`Blast Radius Analysis: ${toolId}`);
        console.log('═'.repeat(60));
        console.log();

        // Impact Summary
        console.log('Impact Summary:');
        console.log(`  Directly affected:     ${analysis.directCount} tools`);
        console.log(`  Transitively affected: ${analysis.transitiveCount} tools`);
        console.log(`  Total blast radius:    ${analysis.totalCount} tools`);
        console.log(`  Max depth:             ${analysis.maxDepth} hops`);
        console.log();

        // Risk Assessment
        console.log('Risk Assessment:');
        console.log(`  Risk Score:        ${analysis.risk.score} (${formatRiskLevel(analysis.risk.level)})`);
        console.log(`  Chain Reliability: ${(analysis.risk.chainReliability * 100).toFixed(1)}%`);
        console.log(`  Avg Debt Score:    ${analysis.risk.avgDebtScore}`);
        if (analysis.risk.criticalCount > 0) {
          console.log(`  Critical Tools:    ${analysis.risk.criticalCount} (MCP)`);
        }
        console.log();

        // Impact by Type
        if (analysis.typeImpacts.length > 0) {
          console.log('Impact by Type:');
          const typeHeaders = ['Type', 'Count', 'Critical'];
          const typeRows = analysis.typeImpacts.map((t) => [
            t.type,
            String(t.count),
            t.critical ? '⚠ Yes' : '',
          ]);
          console.log(formatTable(typeHeaders, typeRows));
          console.log();
        }

        // Impact by Depth
        if (analysis.depthDistribution.size > 0) {
          console.log('Impact by Depth:');
          const sortedDepths = Array.from(analysis.depthDistribution.entries()).sort(
            (a, b) => a[0] - b[0]
          );
          for (const [depth, count] of sortedDepths) {
            const label = depth === 1 ? '(direct)' : '';
            console.log(`  Depth ${depth}:  ${count} tools ${label}`);
          }
          console.log();
        }

        // Rollback Strategy
        if (analysis.rollbackStrategy.length > 0) {
          console.log('Rollback Strategy:');
          for (const step of analysis.rollbackStrategy) {
            console.log(`  ${step}`);
          }
          console.log();
        }

        // Affected Tools Table
        if (analysis.affectedTools.length > 0) {
          console.log('Affected Tools:');
          const toolHeaders = ['ID', 'Name', 'Type', 'Reliability', 'Debt', 'Depth'];
          const toolRows = analysis.affectedTools.map((t) => [
            t.id,
            t.name,
            t.type,
            t.reliability.toFixed(2),
            String(t.debtScore),
            String(t.depth),
          ]);
          console.log(formatTable(toolHeaders, toolRows));
        }
      } catch (err) {
        if (opts.json) {
          const output: BlastRadiusJsonOutput = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          logError(err instanceof Error ? err.message : String(err));
        }
        process.exit(1);
      }
    });
}
