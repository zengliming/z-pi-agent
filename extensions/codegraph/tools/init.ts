// extensions/codegraph/tools/init.ts
// codegraph_init — 初始化项目代码图索引

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor } from "../executor";

// ── 工具注册 ──

export function registerInit(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_init",
    label: "CodeGraph Init",
    description:
      "Initialize CodeGraph in the current project and build the initial index. Creates the .codegraph/ directory and populates it with the symbol graph. Run this once per project before using any other codegraph_* tools.",
    parameters: Type.Object({
      verbose: Type.Optional(
        Type.Boolean({
          default: false,
          description: "Show detailed worker lifecycle and memory info during indexing",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const executor = new CodeGraphExecutor();

      // 先检查代码图是否已存在
      const existing = executor.findProjectRoot(ctx.cwd);
      if (existing) {
        return {
          content: [
            {
              type: "text",
              text: `✅ CodeGraph is already initialized in this project.\n\nProject root: \`${existing}\`\n\nRun \`codegraph index\` if you need to force a full re-index.`,
            },
          ],
          details: { tool: "codegraph_init", alreadyInitialized: true, projectRoot: existing },
        };
      }

      // 检查二进制
      const binTest = executor.checkReady(ctx.cwd);
      if (!binTest.ready && binTest.message.includes("not detected")) {
        return {
          content: [{ type: "text", text: binTest.message }],
          details: { error: "not_ready" },
        };
      }

      const args = ["init"];
      if (params.verbose) args.push("--verbose");

      const result = executor.exec<string>(args, ctx.cwd);
      if (!result.success) {
        // CodeGraph init 可能返回非零退出码但已成功初始化
        // 重新检查项目根
        const root = executor.findProjectRoot(ctx.cwd);
        if (root) {
          return {
            content: [
              {
                type: "text",
                text: `✅ CodeGraph initialized.\n\nProject root: \`${root}\`\n\nThe index has been built. You can now use all \`codegraph_*\` tools.`,
              },
            ],
            details: { tool: "codegraph_init", projectRoot: root },
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph init failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const output = result.data
        ? Array.isArray(result.data)
          ? result.data.join("\n")
          : String(result.data)
        : "";

      // 确认初始化成功
      const root = executor.findProjectRoot(ctx.cwd);
      if (root) {
        return {
          content: [
            {
              type: "text",
              text:
                output
                  ? `✅ CodeGraph initialized.\n\n\`\`\`\n${output}\n\`\`\`\n\nProject root: \`${root}\``
                  : `✅ CodeGraph initialized.\n\nProject root: \`${root}\``,
            },
          ],
          details: { tool: "codegraph_init", projectRoot: root, output },
        };
      }

      return {
        content: [
          {
            type: "text",
            text:
              output
                ? `✅ CodeGraph init ran.\n\n\`\`\`\n${output}\n\`\`\``
                : "✅ CodeGraph init completed.",
          },
        ],
        details: { tool: "codegraph_init", output },
      };
    },
  });
}
