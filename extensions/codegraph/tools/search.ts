// extensions/codegraph/tools/search.ts
// codegraph_search — 按名称搜索符号

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor, type CodeGraphNode } from "../executor";

// ── CLI 输出类型 ──

interface QueryResult {
  node: CodeGraphNode;
  score: number;
}

// ── 格式化 ──

function formatResults(data: QueryResult[], query: string): string {
  if (!data || data.length === 0)
    return `No symbols found matching "${query}".`;

  const lines: string[] = [
    `## 🔍 Search: \`${query}\``,
    `Found **${data.length}** result(s)`,
    "",
  ];

  for (const item of data) {
    const n = item.node;
    const loc = `${n.filePath}:${n.startLine}:${n.startColumn}`;
    const sig = n.signature ? ` \`${n.signature}\`` : "";

    lines.push(
      `- **${n.kind}** \`${n.qualifiedName}\`${sig}`,
      `  - 📁 ${loc}`,
      `  - 🏷 ${n.language} · 📊 ${item.score.toFixed(0)}% match`,
      ""
    );
  }

  if (data.length >= 20) {
    lines.push(
      `> ℹ️ Showing up to ${data.length} results. Use a more specific query or add \`kind\` filter to narrow down.`
    );
  }

  return lines.join("\n");
}

// ── 工具注册 ──

export function registerSearch(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_search",
    label: "CodeGraph Search",
    description:
      "Search symbols (functions, classes, methods, variables, interfaces, imports, etc.) by name across the codebase. Returns matching symbols ranked by relevance. Use this instead of grep/find when you need to locate a symbol definition.",
    parameters: Type.Object({
      query: Type.String({
        description: "Symbol name to search for (supports partial and fuzzy matching)",
      }),
      kind: Type.Optional(
        Type.String({
          description:
            "Filter by node kind: function, class, method, variable, interface, import, file, etc.",
        })
      ),
      limit: Type.Optional(
        Type.Number({
          default: 20,
          description: "Maximum number of results (max 50)",
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

      const args = ["query", params.query];
      if (params.kind) args.push("--kind", params.kind);
      args.push("--limit", String(Math.min(params.limit ?? 20, 50)));
      args.push("--json");

      const result = executor.exec<QueryResult[]>(args, ctx.cwd);
      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph search failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const data = result.data ?? [];
      return {
        content: [{ type: "text", text: formatResults(data, params.query) }],
        details: {
          tool: "codegraph_search",
          query: params.query,
          results: data.length,
          truncated: data.length >= (params.limit ?? 20),
          raw: data,
        },
      };
    },
  });
}
