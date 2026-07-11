// extensions/codegraph/tools/sync.ts
// codegraph_sync — 增量同步索引

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodeGraphExecutor } from "../executor";

// ── 工具注册 ──

export function registerSync(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_sync",
    label: "CodeGraph Sync",
    description:
      "Incrementally sync the CodeGraph index after file changes. Keeps the symbol graph up to date without a full re-index. Run this after editing files to ensure the index reflects current code before querying.",
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

      const result = executor.exec<string>(["sync"], ctx.cwd);
      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `❌ CodeGraph sync failed:\n\`\`\`\n${result.error}\n\`\`\``,
            },
          ],
          details: { error: "exec_failed", detail: result.error },
        };
      }

      const output = result.data ? (Array.isArray(result.data) ? result.data.join("\n") : String(result.data)) : "";

      return {
        content: [
          {
            type: "text",
            text:
              output
                ? `✅ CodeGraph index synced.\n\n\`\`\`\n${output}\n\`\`\``
                : "✅ CodeGraph index is already up to date — no changes to sync.",
          },
        ],
        details: {
          tool: "codegraph_sync",
          output: output || "(already up to date)",
        },
      };
    },
  });
}
