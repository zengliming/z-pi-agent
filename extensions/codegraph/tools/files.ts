// extensions/codegraph/tools/files.ts
// codegraph_files — 查看索引文件结构

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor } from "../executor";

// ── CLI 输出类型 ──

interface FileEntry {
  path: string;
  language: string;
  nodeCount: number;
  size: number;
}

// ── 格式化 ──

function formatResult(
  data: FileEntry[],
  filter?: string,
  pattern?: string
): string {
  if (!data || data.length === 0) {
    return "No indexed files found. Run `codegraph index` first.";
  }

  const totalNodes = data.reduce((sum, f) => sum + f.nodeCount, 0);
  const totalSize = data.reduce((sum, f) => sum + f.size, 0);

  const lines: string[] = [
    `## 📁 Indexed Files`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total files | ${data.length} |`,
    `| Total symbols | ${totalNodes} |`,
    `| Total size | ${(totalSize / 1024).toFixed(1)} KB |`,
    "",
  ];

  if (filter) lines.push(`Filter: \`${filter}\``);
  if (pattern) lines.push(`Pattern: \`${pattern}\``);
  if (filter || pattern) lines.push("");

  // 按语言分组
  const byLang = new Map<string, FileEntry[]>();
  for (const f of data) {
    const list = byLang.get(f.language) ?? [];
    list.push(f);
    byLang.set(f.language, list);
  }

  for (const [lang, files] of byLang) {
    lines.push(`### ${lang} (${files.length} file(s))`);
    for (const f of files) {
      lines.push(
        `- \`${f.path}\` — ${f.nodeCount} symbol(s), ${(f.size / 1024).toFixed(1)} KB`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── 工具注册 ──

export function registerFiles(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_files",
    label: "CodeGraph Files",
    description:
      "List indexed files in the project. Faster than filesystem scanning — returns the file structure from the pre-built index with metadata (language, symbol count, size). Supports filtering by directory or glob pattern.",
    parameters: Type.Object({
      filter: Type.Optional(
        Type.String({
          description: "Filter to files under this subdirectory (e.g. 'extensions', 'src')",
        })
      ),
      pattern: Type.Optional(
        Type.String({
          description: "Glob pattern to filter files (e.g. '*.ts', '*.py')",
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

      const args = ["files", "--json"];
      if (params.filter) args.push("--filter", params.filter);
      if (params.pattern) args.push("--pattern", params.pattern);

      const result = executor.exec<FileEntry[]>(args, ctx.cwd);
      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph files query failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const data = result.data ?? [];
      return {
        content: [
          { type: "text", text: formatResult(data, params.filter, params.pattern) },
        ],
        details: {
          tool: "codegraph_files",
          count: data.length,
          filter: params.filter,
          pattern: params.pattern,
          raw: data,
        },
      };
    },
  });
}
