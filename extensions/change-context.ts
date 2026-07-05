// extensions/change-context.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { Type } from "typebox";

function run(command: string, cwd: string) {
  try {
    return execSync(command, {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    }).trim();
  } catch (error) {
    return "";
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "change_context",
    label: "Change Context",
    description: "Collect git diff, changed files, config changes, and generated-file hints for the current workspace.",
    parameters: Type.Object({
      stagedOnly: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      // Check if git is installed
      if (!run("git --version", ctx.cwd)) {
        return {
          content: [
            {
              type: "text",
              text: "Git is not installed or not available in the current environment. Please install Git and try again.",
            },
          ],
          details: {
            error: "git not installed",
          },
        };
      }

      // Check if current directory is a git repository
      if (!run("git rev-parse --git-dir", ctx.cwd)) {
        return {
          content: [
            {
              type: "text",
              text: "The current directory is not a Git repository. Please initialize a Git repository (git init) or navigate to a Git repository and try again.",
            },
          ],
          details: {
            error: "not a git repository",
          },
        };
      }

      const diffCommand = params.stagedOnly
        ? "git diff --cached -- ."
        : "git diff -- .";

      const changedFilesCommand = params.stagedOnly
        ? "git diff --cached --name-only -- ."
        : "git diff --name-only -- .";

      const diff = run(diffCommand, ctx.cwd);
      const changedFiles = run(changedFilesCommand, ctx.cwd)
        .split("\n")
        .map((file) => file.trim())
        .filter(Boolean);

      const configHints = changedFiles.filter((file) =>
        /(^|\/)(\.github\/workflows\/|\.?[^/]*config[^/]*|[^/]*rc(\..*)?|Makefile|Dockerfile|compose\.ya?ml)$|\.ya?ml$|\.toml$|\.ini$|\.env(\..*)?$/.test(file)
      );

      const largeFiles = changedFiles.filter((file) =>
        /\.(lock|snap|svg|json)$/.test(file)
      );

      const context = {
        mode: params.stagedOnly ? "staged" : "unstaged",
        summary: run(`git diff${params.stagedOnly ? " --cached" : ""} --stat -- .`, ctx.cwd),
        changedFiles,
        configHints,
        largeFiles,
        diff,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(context, null, 2),
          },
        ],
        details: {
          files: changedFiles.length,
          bytes: Buffer.byteLength(diff, "utf8"),
          configHints: configHints.length,
          largeFiles: largeFiles.length,
        },
      };
    },
  });
}