// extensions/codegraph/tools/status.ts
// codegraph_status — 查看索引健康状态和统计

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor } from "../executor";

// ── CLI 输出类型 ──

interface StatusResult {
  initialized: boolean;
  projectPath: string;
  fileCount: number;
  nodeCount: number;
  edgeCount: number;
  dbSizeBytes: number;
  backend: string;
  journalMode: string;
  nodesByKind: Record<string, number>;
  languages: string[];
  pendingChanges: {
    added: number;
    modified: number;
    removed: number;
  };
  worktreeMismatch: string | null;
}

// ── 格式化 ──

function formatResult(data: StatusResult): string {
  if (!data.initialized) {
    return "❌ CodeGraph is not initialized in this project. Run `codegraph init` to set it up.";
  }

  const dbSize =
    data.dbSizeBytes < 1024
      ? `${data.dbSizeBytes} B`
      : data.dbSizeBytes < 1024 * 1024
        ? `${(data.dbSizeBytes / 1024).toFixed(1)} KB`
        : `${(data.dbSizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  const kindBreakdown = Object.entries(data.nodesByKind)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `  - ${kind}: ${count}`)
    .join("\n");

  const pending =
    data.pendingChanges.added +
    data.pendingChanges.modified +
    data.pendingChanges.removed;

  const lines: string[] = [
    `## 📊 CodeGraph Status`,
    "",
    "### Summary",
    "| Metric | Value |",
    "|--------|-------|",
    `| Project | \`${data.projectPath}\` |`,
    `| Initialized | ✅ Yes |`,
    `| Files indexed | ${data.fileCount} |`,
    `| Symbols (nodes) | ${data.nodeCount} |`,
    `| Relationships (edges) | ${data.edgeCount} |`,
    `| Database size | ${dbSize} |`,
    `| Backend | ${data.backend} |`,
    `| Journal mode | ${data.journalMode} |`,
    "",
  ];

  if (data.languages.length > 0) {
    lines.push(`### Languages\n${data.languages.map((l) => `- ${l}`).join("\n")}\n`);
  }

  lines.push(`### Nodes by Kind\n\n${kindBreakdown}\n`);

  if (pending > 0) {
    lines.push(
      `### ⚠️ Pending Changes (${pending} file(s))`,
      `| Status | Count |`,
      `|--------|-------|`,
      `| Added | ${data.pendingChanges.added} |`,
      `| Modified | ${data.pendingChanges.modified} |`,
      `| Removed | ${data.pendingChanges.removed} |`,
      "",
      "Run \`codegraph sync\` to update the index.",
      ""
    );
  } else {
    lines.push(`### Pending Changes\n\nNone — the index is up to date.\n`);
  }

  if (data.worktreeMismatch) {
    lines.push(
      `### ⚠️ Worktree Mismatch\n\n\`\`\`\n${data.worktreeMismatch}\n\`\`\`\n`
    );
  }

  return lines.join("\n");
}

// ── 工具注册 ──

export function registerStatus(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_status",
    label: "CodeGraph Status",
    description:
      "Show CodeGraph index health, statistics, and any pending changes. Use this to check if the index is up to date before querying, or to get an overview of the codebase structure.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const executor = new CodeGraphExecutor();
      const ready = executor.checkReady(ctx.cwd);
      if (!ready.ready) {
        return {
          content: [{ type: "text", text: ready.message }],
          details: { error: "not_ready" },
        };
      }

      const result = executor.exec<StatusResult>(["status", "--json"], ctx.cwd);
      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph status check failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const data = result.data!;
      return {
        content: [{ type: "text", text: formatResult(data) }],
        details: {
          tool: "codegraph_status",
          fileCount: data.fileCount,
          nodeCount: data.nodeCount,
          edgeCount: data.edgeCount,
          languages: data.languages,
          pendingChanges: data.pendingChanges,
          raw: data,
        },
      };
    },
  });
}
