// extensions/codegraph/tools/callees.ts
// codegraph_callees — 查找某函数/方法调用了哪些符号

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor } from "../executor";

// ── CLI 输出类型 ──

interface CalleeEntry {
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
}

interface CalleesResult {
  symbol: string;
  callees: CalleeEntry[];
}

// ── 格式化 ──

function formatResult(data: CalleesResult): string {
  if (!data.callees || data.callees.length === 0) {
    return `\`${data.symbol}\` calls no other indexed symbols (or it has no function body to analyze).`;
  }

  const lines: string[] = [
    `## ⬇️ Callees of \`${data.symbol}\``,
    `This symbol calls **${data.callees.length}** other symbol(s)`,
    "",
  ];

  // 按文件分组
  const byFile = new Map<string, CalleeEntry[]>();
  for (const c of data.callees) {
    const list = byFile.get(c.filePath) ?? [];
    list.push(c);
    byFile.set(c.filePath, list);
  }

  for (const [file, callees] of byFile) {
    lines.push(`📁 \`${file}\``);
    for (const c of callees) {
      lines.push(`  - **${c.kind}** \`${c.name}\` (line ${c.startLine})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── 工具注册 ──

export function registerCallees(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_callees",
    label: "CodeGraph Callees",
    description:
      "Find all functions, methods, and symbols that a given function or method calls. Useful for understanding a function's dependency chain and tracing how it works internally.",
    parameters: Type.Object({
      symbol: Type.String({
        description:
          "Symbol name to find callees for (e.g. 'run', 'findBinary'). Use the exact symbol name as it appears in code.",
      }),
      limit: Type.Optional(
        Type.Number({
          default: 20,
          description: "Maximum number of callee results (max 50)",
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
        "callees",
        params.symbol,
        "--limit",
        String(Math.min(params.limit ?? 20, 50)),
        "--json",
      ];

      const result = executor.exec<CalleesResult>(args, ctx.cwd);
      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph callees query failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const data = result.data!;
      return {
        content: [{ type: "text", text: formatResult(data) }],
        details: {
          tool: "codegraph_callees",
          symbol: params.symbol,
          count: data.callees?.length ?? 0,
          truncated: (data.callees?.length ?? 0) >= (params.limit ?? 20),
          raw: data,
        },
      };
    },
  });
}
