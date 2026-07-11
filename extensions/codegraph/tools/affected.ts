// extensions/codegraph/tools/affected.ts
// codegraph_affected — 查找受变更影响的测试文件

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor } from "../executor";

// ── CLI 输出类型 ──

interface AffectedResult {
  changedFiles: string[];
  affectedTests: string[];
  totalDependentsTraversed: number;
}

// ── 格式化 ──

function formatResult(data: AffectedResult): string {
  const lines: string[] = [
    `## 🧪 Affected Tests Analysis`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Changed files | ${data.changedFiles.length} |`,
    `| Affected test files | ${data.affectedTests.length} |`,
    `| Dependents traversed | ${data.totalDependentsTraversed} |`,
    "",
  ];

  if (data.changedFiles.length > 0) {
    lines.push("### Changed Files\n");
    for (const f of data.changedFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push("");
  }

  if (data.affectedTests.length > 0) {
    lines.push("### Affected Tests — Run These\n");
    for (const t of data.affectedTests) {
      lines.push(`- \`${t}\``);
    }
    lines.push("");

    if (data.affectedTests.length <= 5) {
      lines.push(
        "**Suggested command:**\n\n```bash\n" +
          data.affectedTests.map((t) => `npx vitest run "${t}"`).join("\n") +
          "\n```\n"
      );
    } else {
      lines.push(
        "**Suggested command:**\n\n```bash\n" +
          `npx vitest run ${data.affectedTests.map((t) => `"${t}"`).join(" ")}` +
          "\n```\n"
      );
    }
  } else {
    lines.push(
      "No test files are affected by the changed source files.\n\n" +
        "Possible reasons:\n" +
        "- The changed files have no test coverage in the indexed graph\n" +
        "- The changes are in files that no tests depend on\n" +
        "- Test files may not be indexed yet (run `codegraph sync`)\n"
    );
  }

  return lines.join("\n");
}

// ── 工具注册 ──

export function registerAffected(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_affected",
    label: "CodeGraph Affected Tests",
    description:
      "Find test files affected by changed source files. Traces import dependencies transitively to find which test files should be run after changes. Pass specific files or pipe from git diff. Useful before committing to ensure you run the right tests.",
    parameters: Type.Object({
      files: Type.Array(Type.String(), {
        description:
          "One or more changed file paths (relative to project root, e.g. ['src/utils.ts', 'src/api.ts'])",
      }),
      depth: Type.Optional(
        Type.Number({
          default: 5,
          description: "Maximum dependency traversal depth (1-20, default 5)",
        })
      ),
      filter: Type.Optional(
        Type.String({
          description:
            "Custom glob pattern to identify test files (e.g. 'e2e/*.spec.ts', '**/*.test.ts')",
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

      const args = ["affected", ...params.files];
      if (params.depth) args.push("--depth", String(Math.min(Math.max(params.depth, 1), 20)));
      if (params.filter) args.push("--filter", params.filter);
      args.push("--json");

      const result = executor.exec<AffectedResult>(args, ctx.cwd);
      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph affected-tests analysis failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const data = result.data!;
      return {
        content: [{ type: "text", text: formatResult(data) }],
        details: {
          tool: "codegraph_affected",
          changedFiles: data.changedFiles,
          affectedTests: data.affectedTests,
          traversed: data.totalDependentsTraversed,
          raw: data,
        },
      };
    },
  });
}
