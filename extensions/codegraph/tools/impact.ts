// extensions/codegraph/tools/impact.ts
// codegraph_impact — 分析修改某符号的影响范围

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor } from "../executor";

// ── CLI 输出类型 ──

interface AffectedEntry {
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
}

interface ImpactResult {
  symbol: string;
  depth: number;
  nodeCount: number;
  edgeCount: number;
  affected: AffectedEntry[];
}

// ── 格式化 ──

function formatResult(data: ImpactResult): string {
  if (!data.affected || data.affected.length === 0) {
    return `No impact chain found for \`${data.symbol}\` (depth=${data.depth}). The symbol might not be used anywhere else.`;
  }

  const lines: string[] = [
    `## 💥 Impact Analysis: \`${data.symbol}\``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Affected nodes | ${data.nodeCount} |`,
    `| Edges traversed | ${data.edgeCount} |`,
    `| Max depth | ${data.depth} |`,
    "",
    "### Affected Symbols",
    "",
  ];

  // 按文件分组
  const byFile = new Map<string, AffectedEntry[]>();
  for (const a of data.affected) {
    const list = byFile.get(a.filePath) ?? [];
    list.push(a);
    byFile.set(a.filePath, list);
  }

  for (const [file, symbols] of byFile) {
    lines.push(`📁 \`${file}\``);
    for (const s of symbols) {
      const isTarget = s.name === data.symbol && s.kind !== "file";
      const prefix = isTarget
        ? `  - ⚡ **${s.kind}** \`${s.name}\` ← target`
        : `  - **${s.kind}** \`${s.name}\` (line ${s.startLine})`;
      lines.push(prefix);
    }
    lines.push("");
  }

  lines.push(
    "> ⚠️ Review these files carefully before making changes to the target symbol."
  );

  return lines.join("\n");
}

// ── 工具注册 ──

export function registerImpact(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_impact",
    label: "CodeGraph Impact",
    description:
      "Analyze what code is affected by changing a specific symbol. Traverses callers transitively to find the full impact radius. Use before refactoring or modifying a function to understand what depends on it.",
    parameters: Type.Object({
      symbol: Type.String({
        description:
          "Symbol name to analyze impact for (e.g. 'run', 'findBinary'). Use the exact symbol name.",
      }),
      depth: Type.Optional(
        Type.Number({
          default: 2,
          description: "Maximum traversal depth for transitive impact analysis (1-10, default 2). Higher depth finds more indirect dependencies.",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const executor = new CodeGraphExecutor();
      const ready = executor.checkReady(ctx.cwd);
      if (!ready.ready) {
        return {
          content: [{ type: "text", text: ready.message }],
          details: { error: "not_ready" },
        };
      }

      const args = [
        "impact",
        params.symbol,
        "--depth",
        String(Math.min(Math.max(params.depth ?? 2, 1), 10)),
        "--json",
      ];

      const result = executor.exec<ImpactResult>(args, ctx.cwd);
      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph impact analysis failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const data = result.data!;
      return {
        content: [{ type: "text", text: formatResult(data) }],
        details: {
          tool: "codegraph_impact",
          symbol: params.symbol,
          depth: data.depth,
          nodeCount: data.nodeCount,
          edgeCount: data.edgeCount,
          raw: data,
        },
      };
    },
  });
}
