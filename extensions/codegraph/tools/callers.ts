// extensions/codegraph/tools/callers.ts
// codegraph_callers — 查找调用了某符号的所有函数/方法

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor } from "../executor";

// ── CLI 输出类型 ──

interface CallerEntry {
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
}

interface CallersResult {
  symbol: string;
  callers: CallerEntry[];
}

// ── 格式化 ──

function formatResult(data: CallersResult): string {
  if (!data.callers || data.callers.length === 0) {
    return `No callers found for \`${data.symbol}\`.\n\nThe symbol may be unused or only referenced indirectly.`;
  }

  const lines: string[] = [
    `## ⬆️ Callers of \`${data.symbol}\``,
    `Found **${data.callers.length}** direct caller(s)`,
    "",
  ];

  // 按文件分组
  const byFile = new Map<string, CallerEntry[]>();
  for (const c of data.callers) {
    const list = byFile.get(c.filePath) ?? [];
    list.push(c);
    byFile.set(c.filePath, list);
  }

  for (const [file, callers] of byFile) {
    lines.push(`📁 \`${file}\``);
    for (const c of callers) {
      lines.push(`  - **${c.kind}** \`${c.name}\` (line ${c.startLine})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── 工具注册 ──

export function registerCallers(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_callers",
    label: "CodeGraph Callers",
    description:
      "Find all functions and methods that call a specific symbol. Useful for understanding how a function is used before modifying or refactoring it.",
    parameters: Type.Object({
      symbol: Type.String({
        description:
          "Symbol name to find callers for (e.g. 'run', 'findBinary', 'shell'). Use the exact symbol name as it appears in code.",
      }),
      limit: Type.Optional(
        Type.Number({
          default: 20,
          description: "Maximum number of caller results (max 50)",
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
        "callers",
        params.symbol,
        "--limit",
        String(Math.min(params.limit ?? 20, 50)),
        "--json",
      ];

      const result = executor.exec<CallersResult>(args, ctx.cwd);
      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph callers query failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const data = result.data!;
      return {
        content: [{ type: "text", text: formatResult(data) }],
        details: {
          tool: "codegraph_callers",
          symbol: params.symbol,
          count: data.callers?.length ?? 0,
          truncated: (data.callers?.length ?? 0) >= (params.limit ?? 20),
          raw: data,
        },
      };
    },
  });
}
